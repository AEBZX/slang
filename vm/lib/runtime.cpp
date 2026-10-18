#include <algorithm>

#include "../main.h"
static uint64_t seed = 88172645463325252ULL;
static inline int32_t random() {
    seed ^= seed << 13;
    seed ^= seed >> 7;
    seed ^= seed << 17;
    return (int32_t)seed%0xFFFFFF;
}
static inline int pool_random(const runtime::ConstPool* data)
{
    int rand;
    while (true)
    {
        rand=random();
        if (data->number_pool.contains(rand)||data->string_pool.contains(rand))continue;
        return rand;
    }
}
void runtime::ConstPool::run()
{
    while (true)
    {
        if (_stop)return;
        _continue=false;
        std::vector<pool_task> snap;
        {
            std::lock_guard lk(mtx);
            std::ranges::copy_if(this->task,std::back_inserter(snap),[](const runtime::pool_task p)
            {
                return !p.key3;
            });
        }
        std::vector<int> ok_list;
        for (size_t i = 0; i < snap.size(); ++i)
        {
            bool _run=true;
            for (int j : snap[i].key1)
                if (this->lock[j])
                {
                    _run=false;
                    break;
                }
            if (!_run)break;
            for (int j : snap[i].key1)
                this->lock[j]=true;
            data::scheduler().spawn([&]
            {
                snap[i].key2(this,snap[i].key1);
                ok_list.push_back(i);
                for (int j : snap[i].key1)
                {
                    this->lock[j]=false;
                    std::lock_guard lk(wait_mtx);
                    this->_continue=true;
                }
            });
        }
        data::scheduler().spawn([&]
        {
            std::lock_guard lk(mtx);
            for (const int i:ok_list)
                this->task[i].key3=true;
        });
        std::unique_lock lk(wait_mtx);
        cv.wait(lk, [this]{return _continue;});
    }
}
void runtime::ConstPool::link(const int& id)
{
    task.push_back(pool_task
        ({},[id](ConstPool* data, const std::vector<int>&)
        {
            if (data->gc_list.contains(id))
                data->gc_list.erase(id);
            ++data->linked[id];
        },false));
}
int runtime::ConstPool::id_number(const double& num)
{
    if (number_pool_rev.contains(num))
        return number_pool_rev[num];
    const int id=pool_random(this);
    number_pool[id]=num;
    number_pool_rev[num]=id;
    return id;
}
int runtime::ConstPool::id_string(const std::string& str)
{
    if (string_pool_rev.contains(str))
        return string_pool_rev[str];
    const int id=pool_random(this);
    string_pool[id]=str;
    string_pool_rev[str]=id;
    return id;
}
void runtime::ConstPool::unlink(const int& id)
{
    task.push_back(pool_task
        ({},[id](ConstPool* data,const std::vector<int>&)
        {
            if (data->gc_list.contains(id))
                return;
            --data->linked[id];
            if (data->linked[id]==0)
                data->gc_list.insert(id);
        },false));
}
void runtime::ConstPool::gc()
{
    task.emplace_back(
        std::vector(gc_list.begin(), gc_list.end()),
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
{
    this->_stop=false;
    this->_continue=false;
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
