#include <algorithm>

#include "../main.h"

//步任务表/常量池涨到这个量就自动排一次 gc(真正的删除仍由 gc 任务做)
static constexpr size_t gc_task_limit=4096;
static constexpr size_t gc_pool_limit=4096;

void runtime::ConstPool::run()
{
    while (true)
    {
        if (_stop)return;
        std::vector<pool_task> batch;
        {
            std::lock_guard lk(mtx);
            for (size_t i = 0; i < task.size() && batch.size() < 64; ++i)
                if (!task[i].key3)
                {
                    task[i].key3 = true;
                    batch.push_back(task[i]);
                }
        }
        if (!batch.empty())
        {
            ++inflight;
            data::scheduler().spawn([this, batch = std::move(batch)]
            {
                //任务体改的是池里的容器,逐个加锁执行,批次之间才不会踩
                for (auto& t : batch)
                {
                    std::lock_guard lk(mtx);
                    t.key2(this, t.key1);
                }
                {
                    std::lock_guard w(wait_mtx);
                    _continue = true;
                }
                cv.notify_all();
                --inflight;
            });
        }
        std::unique_lock idle(wait_mtx);
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
    for (const int i : gc_list)
    {
        if (number_pool.contains(i))
        {
            number_pool_rev.erase(number_pool[i]);
            number_pool.erase(i);
        }
        if (string_pool.contains(i))
        {
            string_pool_rev.erase(string_pool[i]);
            string_pool.erase(i);
        }
    }
    gc_list.clear();
    //压缩任务表:从后往前删已完成的,正着删会跳元素
    for (int i=static_cast<int>(task.size())-1;i>=0;i--)
        if (task[i].key3)
            task.erase(task.begin()+i);
}
runtime::ConstPool::ConstPool(std::unordered_map<int, std::string> str, std::unordered_map<int, double> num)
    : _stop(false), _continue(false)
{
    for (const auto& [id, n] : num)
    {
        number_pool[id]=n;
        number_pool_rev[n]=id;
        data::reserve(id);
    }
    for (const auto& [id,s]:str)
    {
        string_pool[id]=s;
        string_pool_rev[s]=id;
        data::reserve(id);
    }
    worker=std::thread(&ConstPool::run,this);
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
data::any runtime::ConstPool::value(const int& id)
{
    std::lock_guard lk(mtx);
    const auto s=string_pool.find(id);
    if (s!=string_pool.end())return data::any(s->second);
    const auto n=number_pool.find(id);
    return data::any(n==number_pool.end()?0:n->second);
}
double runtime::ConstPool::number(const int& id)
{
    std::lock_guard lk(mtx);
    const auto it = number_pool.find(id);
    return it == number_pool.end() ? 0 : it->second;
}
std::string runtime::ConstPool::str(const int& id)
{
    std::lock_guard lk(mtx);
    const auto it = string_pool.find(id);
    return it == string_pool.end() ? "" : it->second;
}
char runtime::ConstPool::str_char(const int& id,const int& pos)
{
    std::lock_guard lk(mtx);
    const auto it = string_pool.find(id);
    return it == string_pool.end() || pos >= static_cast<int>(it->second.size()) ? '\0' : it->second[pos];
}
void runtime::ConstPool::str_set_char(const int& id,const int& pos,const char& ch)
{
    std::lock_guard lk(mtx);
    const auto it = string_pool.find(id);
    if (it != string_pool.end() && pos < static_cast<int>(it->second.size()))it->second[pos] = ch;
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
size_t runtime::ConstPool::size()
{
    std::lock_guard lk(mtx);
    return number_pool.size() + string_pool.size();
}
bool runtime::ConstPool::pending()
{
    std::lock_guard lk(mtx);
    return !gc_list.empty();
}
runtime::Manage::Manage(const std::unordered_map<int, std::string>& pool_str, const std::unordered_map<int, double>& pool_num,
    std::unordered_map<int, std::vector<data::KV<int, data::three_key<int, int, int>>>> commands, const int& max_id):
    pool(pool_str, pool_num)
{
    pool.string_pool[0]="\0";
    reg[0].bind=0;
    null_reg=reg[0];
    _stop = false;
    for (const auto& [id, cmd] : commands)
        for (const auto& ins:cmd)
            command[id].push_back(instruction_task{{ins.value.key1, ins.value.key2, ins.value.key3},
                instruction::run_table[ins.key],false});
    //头部带下来的号段上界:VM 分新号(容器元素这些)从这之后开始,不然会踩掉程序正在用的槽。
    //编译器用过的槽顺手全插进 reg:运行期就只剩读,不跟并行指令抢插入。
    //模块容器的登记指令编在块0开头,入口从块0起跑天然先执行它们,不需要单独的登记块
    data::reserve(max_id);
    for (int i=0;i<max_id;i++)reg[i];
}
runtime::Manage::~Manage()
{
}
void runtime::Manage::gc()
{
    {
        std::lock_guard lk(mtx);
        //已经排了清理任务就不重复排:自动 gc 每轮都会看阈值
        if (gc_pending)return;
        gc_pending=true;
        task.emplace_back(0, instruction_task{{0,0,0},[](Runtime* rt,int,int,int)
        {
            rt->father->pool.gc();
            {
                std::lock_guard lk(rt->father->mtx);
                //压缩任务表:从后往前删已完成的,正着删会跳元素
                for (int i=static_cast<int>(rt->father->task.size())-1;i>=0;i--)
                    if (rt->father->task[i].value.key3)
                        rt->father->task.erase(rt->father->task.begin()+i);
                //缩表之后旧游标的位置已经没有意义,下次从头扫
                rt->father->scan=0;
                rt->father->gc_pending=false;
            }
        }, false});
    }
}
std::vector<runtime::instruction_task>* runtime::Manage::get(const int& id)
{
    const auto it=command.find(id);
    return it==command.end()?nullptr:&it->second;
}
void runtime::Manage::write_slot(const int& id,const Reg& r)
{
    std::lock_guard lk(reg_mtx);
    reg[id]=r;
}
void runtime::Manage::delete_reg(const int& id)
{
    {
        std::lock_guard lk(mtx);
        task.emplace_back(0,instruction_task{{id,0,0},[id](const Runtime* rt,int,int,int)
        {
            rt->father->reg.erase(id);
        }, false});
    }
}
void runtime::Manage::stop()
{
    _stop=true;
}
void runtime::Manage::malloc(const int& _id , const int& frame, const Runtime* extends)
{
    const int __id=id++;
    {
        //运行时表会被执行器并发地 find,插入要护住
        std::lock_guard lk(runtime_mtx);
        runtime[__id].id=__id;
        runtime[__id].father=this;
        if (!_start)
        {
            _start=true;
            runtime[__id].now.instruction=get(0);
            runtime[__id].now.pc=0;
            runtime[__id].now.type=0;
        }
        else
        {
            runtime[__id].param=extends->param;
            runtime[__id].out=extends->out;
            runtime[__id]._stack=extends->_stack;
            runtime[__id].now.instruction=get(_id);
            runtime[__id].now.pc=0;
            runtime[__id].now.type=frame;
        }
    }
    schedule(__id);
}
bool runtime::Manage::claim(const int& a,const int& b,const int& c)
{
    //0 是空槽哨兵,不参与占用
    std::lock_guard lk(mtx);
    if((a&&lock[a])||(b&&lock[b])||(c&&lock[c]))return false;
    if(a)lock[a]=true;
    if(b)lock[b]=true;
    if(c)lock[c]=true;
    return true;
}
void runtime::Manage::release(const int& a,const int& b,const int& c)
{
    std::lock_guard lk(mtx);
    if(a)lock[a]=false;
    if(b)lock[b]=false;
    if(c)lock[c]=false;
}
void runtime::Manage::schedule(const int& id)
{
    std::lock_guard lk(mtx);
    Runtime* rt=nullptr;
    {
        std::lock_guard rk(runtime_mtx);
        const auto it=runtime.find(id);
        if (it!=runtime.end())rt=&it->second;
    }
    //同一运行时的步任务是串行的:已经有一条在等/在跑就不再排,避免跳转后的
    //指令被旧的步任务抢先分派到另一个批次
    if (rt==nullptr||rt->step_pending)return;
    rt->step_pending=true;
    task.push_back({id,instruction_task{{0,0,0},[](Runtime* rt,int,int,int)
    {
        {
            std::lock_guard lk(rt->father->mtx);
            //标记已被别的步任务消费就不要再跑:同一运行时永远只有一条步在推进
            if (!rt->step_pending)return;
            rt->step_pending=false;
        }
        rt->step();
    },false}});
}
void runtime::Manage::start()
{
    malloc(0,0,nullptr);
    while (true)
    {
        if (_stop)break;
        std::vector<data::KV<int,instruction_task>> batch;
        bool need_gc=false;
        {
            std::lock_guard lk(mtx);
            //队列涨到阈值且游标前面有已完成项才值得排清理;删除本身仍归 gc
            need_gc=task.size()>gc_task_limit&&scan>0;
            //只往后看新追加的任务:已完成的项不重扫,也不在这里搬元素
            size_t i=scan;
            for (; i < task.size() && batch.size() < 64; ++i)
                if (!task[i].value.key3)
                {
                    task[i].value.key3 = true;
                    batch.push_back(task[i]);
                }
            scan=i;
        }
        //池很大且确实有待回收项时也排一次清理;没有可回收项就不必空转
        if (!need_gc&&pool.size()>gc_pool_limit&&pool.pending())need_gc=true;
        if (need_gc)gc();
        if (!batch.empty())
        {
            ++inflight;
            data::scheduler().spawn([this, batch = std::move(batch)]
            {
                for (auto& t : batch)
                {
                    Runtime* rt=nullptr;
                    {
                        std::lock_guard lk(runtime_mtx);
                        const auto it=runtime.find(t.key);
                        if (it!=runtime.end())rt=&it->second;
                    }
                    if (rt!=nullptr)
                        t.value.key2(rt,t.value.key1[0],t.value.key1[1],t.value.key1[2]);
                }
                {
                    std::lock_guard w(wait_mtx);
                    _continue = true;
                }
                cv.notify_all();
                --inflight;
            });
        }
        std::unique_lock idle(wait_mtx);
        cv.wait_for(idle, std::chrono::milliseconds(2),
            [this] { return _stop || _continue; });
        _continue = false;
    }
    //等在途批次跑完再返回,协程还捕获着 this 时不能让 Manage 先死
    for (int i=0;i<2000&&inflight.load()>0;++i)
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
}
runtime::Runtime::Runtime()
{
}
runtime::Runtime::~Runtime()
{
}
void runtime::Runtime::step()
{
    std::vector<instruction_task>& list=*now.instruction;
    if (now.pc>=list.size())
    {
        //块尾:有帧就返回上一层;帧栈空了就是跑完了,主运行时结束即停机
        if (frames.empty())
        {
            if (id==0)father->stop();
            return;
        }
        now=frames.top();
        frames.pop();
    }
    else
    {
        const instruction_task& ins=list[now.pc];
        //操作数槽被别的运行时占着就把这一步让出去,重新排队等它放掉
        if (!father->claim(ins.key1[0],ins.key1[1],ins.key1[2]))
        {
            father->schedule(id);
            return;
        }
        ++now.pc;
        ins.key2(this,ins.key1[0],ins.key1[1],ins.key1[2]);
        father->release(ins.key1[0],ins.key1[1],ins.key1[2]);
    }
    father->schedule(id);
}
