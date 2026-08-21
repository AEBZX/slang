public std:module{
    public system:module{
        public static type:string='system';
        public static const_system_memory='memory_global';
        public static const_process_memory='memory_self';
        public static const_disk='disk';
        public static const_core_num='core_num';
        public static ret:number=null;
        public static SystemMemory:number(){
            vm 'out %type %const_system_memory';
            vm 'in %type %ret';
            return ret;
        }
        public static ProcessMemory:number(){
            vm 'out %type %const_process_memory';
            vm 'in %type %ret';
            return ret;
        }
        public static Disk:string(){
            vm 'out %type %const_disk';
            vm 'in %type %ret';
            return ret;
        }
        public static CoreNum:number(){
            vm 'out %type %const_core_num';
            vm 'in %type %ret';
            return ret;
        }
    }
}