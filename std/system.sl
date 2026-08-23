public std:module{
    public system:module{
        public static type:var:string='system';
        public static const_system_memory:var:string='memory_global';
        public static const_process_memory:var:string='memory_self';
        public static const_disk:var:string='disk';
        public static const_core_num:var:string='core_num';
        public static ret:var:number;
        public static SystemMemory:number(){
            vm 'out %type %const_system_memory';
            vm 'in %type %ret';
            return std.system.ret;
        }
        public static ProcessMemory:number(){
            vm 'out %type %const_process_memory';
            vm 'in %type %ret';
            return std.system.ret;
        }
        public static Disk:number(){
            vm 'out %type %const_disk';
            vm 'in %type %ret';
            return std.system.ret;
        }
        public static CoreNum:number(){
            vm 'out %type %const_core_num';
            vm 'in %type %ret';
            return std.system.ret;
        }
    }
}
