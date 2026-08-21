public std:module{
    public io:module{
        public static oper:string='shell';
        public static print:void(data:string){
            var d:string{}=[type:'print',data:data];
            vm 'out %oper %d';
        }
        public static input:void(data:string*){
            var d:string{}=[type:'input'];
            vm 'out %oper %d';
            vm 'in %oper %data';
        }
        public static exec:void(command:string){
            var d:string{}=[type:'shell',data:command];
            vm 'out %oper %d';
        }
    }
}