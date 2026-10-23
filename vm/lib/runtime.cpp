#include <algorithm>

#include "../main.h"
void runtime::ConstPool::run()
{
    while (true)
    {
        if (_stop)return;
        std::vector<std::pair<size_t, pool_task>> batch;
        {
            std::lock_guard lk(mtx);
            for (size_t i = 0; i < task.size() && batch.size() < 64; ++i)
                if (!task[i].key3)
                {
                    task[i].key3 = true;
                    batch.emplace_back(i, task[i]);
                }
        }
        if (!batch.empty())
        {
            ++inflight;
            data::scheduler().spawn([this, batch = std::move(batch)]
            {
                for (auto& [idx, t] : batch)
                    t.key2(this, t.key1);
                {
                    std::lock_guard lk(mtx);
                    for (auto& [idx, t] : batch)
                        task[idx].key3 = true;
                }
                {
                    std::lock_guard w(wait_mtx);
                    _continue = true;
                }
                cv.notify_all();
                --inflight;
            });
        }
        std::unique_lock<std::mutex> idle(wait_mtx);
        cv.wait_for(idle, std::chrono::milliseconds(2),
            [this] { return _stop || _continue; });
        _continue = false;
    }
}
void runtime::ConstPool::stop()
{
    {
        std::lock_guard lk(mtx);
        if (_stop)return;
        _stop = true;
    }
    cv.notify_all();
    if (worker.joinable())
        worker.join();
    for (int i = 0; i < 2000 && inflight.load() > 0; ++i)
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    std::lock_guard lk(mtx);
    task.clear();
}
void runtime::ConstPool::link(const int& id)
{
    pool_task t({id},[id](ConstPool* data, const std::vector<int>&)
        {
            if (data->gc_list.contains(id))
                data->gc_list.erase(id);
            ++data->linked[id];
        },false);
    {
        std::lock_guard lk(mtx);
        task.push_back(std::move(t));
    }
    cv.notify_all();
}
int runtime::ConstPool::id_number(const double& num)
{
    std::lock_guard lk(mtx);
    if (number_pool_rev.contains(num))
        return number_pool_rev[num];
    const int id=data::id();
    number_pool[id]=num;
    number_pool_rev[num]=id;
    return id;
}
int runtime::ConstPool::id_string(const std::string& str)
{
    std::lock_guard lk(mtx);
    if (string_pool_rev.contains(str))
        return string_pool_rev[str];
    const int id=data::id();
    string_pool[id]=str;
    string_pool_rev[std::string_view(string_pool[id])]=id;
    return id;
}
void runtime::ConstPool::unlink(const int& id)
{
    pool_task t({id},[id](ConstPool* data,const std::vector<int>&)
        {
            if (data->gc_list.contains(id))
                return;
            if (data->linked[id] > 0)
                --data->linked[id];
            if (data->linked[id] == 0)
                data->gc_list.insert(id);
        },false);
    {
        std::lock_guard lk(mtx);
        task.push_back(std::move(t));
    }
    cv.notify_all();
}
void runtime::ConstPool::gc()
{
    std::lock_guard lk(mtx);
    task.emplace_back(
        std::vector<int>(gc_list.begin(), gc_list.end()),
        [](ConstPool* data,const std::vector<int>& cond)
        {
            for (int i : cond)
            {
                data->gc_list.erase(i);
                if (data->number_pool.contains(i))
                {
                    data->number_pool_rev.erase(data->number_pool[i]);
                    data->number_pool.erase(i);
                }
                if (data->string_pool.contains(i))
                {
                    data->string_pool_rev.erase(data->string_pool[i]);
                    data->string_pool.erase(i);
                }
            }
        },false
        );
}
runtime::ConstPool::ConstPool(std::unordered_map<int, std::string> str, std::unordered_map<int, double> num)
    : _stop(false), _continue(false)
{
    for (const auto& [id, n] : num)
    {
        number_pool[id]=n;
        number_pool_rev[n]=id;
    }
    for (const auto& [id,s]:str)
    {
        string_pool[id]=s;
        string_pool_rev[s]=id;
    }
}
runtime::ConstPool::~ConstPool()
{
    stop();
}
int runtime::ConstPool::ref_count(const int& id)
{
    std::lock_guard lk(mtx);
    const auto it = linked.find(id);
    return it == linked.end() ? 0 : it->second.load();
}
bool runtime::ConstPool::pending_gc(const int& id)
{
    std::lock_guard lk(mtx);
    return gc_list.contains(id);
}
bool runtime::ConstPool::has(const int& id)
{
    std::lock_guard lk(mtx);
    return number_pool.contains(id) || string_pool.contains(id);
}
