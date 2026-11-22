#include <algorithm>

#include "../main.h"
static constexpr size_t gc_task_limit=4096;
runtime::Manage::Manage(const std::unordered_map<int,std::vector<std::vector<instruction_task>>>& commands,const int max_id){
    _stop = false;
    data::reserve(max_id);
    for (auto& [id,command] : commands)
        this->code[id]=command;
}
runtime::Manage::~Manage()
{
}
void runtime::Manage::gc()
{
    std::lock_guard lk(this->queue_mtx);
    std::erase_if(this->run_queue,[](const auto& task)
    {
        const auto& [a,b]=task;
        return a;
    });
}
std::vector<std::vector<runtime::instruction_task>>* runtime::Manage::get(const int id)
{
    return &code[id];
}
void runtime::Manage::delete_reg(const int id)
{
    reg.erase(id);
}
void runtime::Manage::stop()
{
    _stop=true;
}
void runtime::Manage::malloc(const int _id , const int frame,Runtime* extends)
{
    const int runtime_id=this->runtime_max++;
    runtime[runtime_id].father=this;
    if (extends!=nullptr)
    {
        runtime[runtime_id].param=extends->param;
        runtime[runtime_id].stack=extends->stack;
        runtime[runtime_id].out=extends->out;
    }
    runtime[runtime_id].frame={.block = _id,.frame = frame};
    runtime[runtime_id].start();
}
void runtime::Manage::start()
{
    malloc(0,0,nullptr);
    data::scheduler().spawn([&]()
    {
        while (true)
        {
            if (_stop)break;
            std::vector<instruction_task> tasks;
            {
                std::lock_guard lk(this->queue_mtx);
                tasks = this->run_queue;
            }
            int ok_num=0;
            //遍历找到可执行的任务扔给协程执行
            for (auto& task : tasks)
            {
                if (task.ok)
                {
                    ok_num++;
                    continue;
                }
                if (!task.cond(task.runtime,task.param1,task.param2,task.param3))continue;
                data::scheduler().spawn([&]()
                {
                    task.ins(task.runtime,task.param1,task.param2,task.param3);
                    task.ok=true;
                });
                {
                    std::lock_guard w(wait_mtx);
                    _continue = true;
                }
            }
            if (ok_num>=gc_task_limit)gc();
            cv.notify_all();
            std::unique_lock idle(wait_mtx);
            cv.wait_for(idle, std::chrono::milliseconds(2),[this] { return _stop || _continue; });
            _continue = false;
        }
    });
}
runtime::Runtime::Runtime()
{
}
runtime::Runtime::~Runtime()
{
}
void runtime::Runtime::start()
{
    data::scheduler().spawn([&]()
    {
        while (true)
        {
            if (father->_stop)break;
            std::vector<std::vector<instruction_task>>* ins = father->get(frame.block);
            std::vector<instruction_task> last={};
            for (auto& task :*ins)
            {
                for (auto& command : task)
                {
                    if (!last.empty())
                    {
                        command.cond = [&](Runtime* runtime, int param1, int param2, int param3)->bool
                        {
                            for (const auto& last_command : last)
                            {
                                if (!last_command.ok)
                                    return false;
                            }
                            return command.cond(runtime,param1,param2,param3);
                        };
                    }
                    data::scheduler().spawn([&](){command.ins(command.runtime,command.param1,command.param2,command.param3);});
                }
                last=task;
            }
        }
    });
}
