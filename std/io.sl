public std:module{
    public io:module{
        public static oper:var:string='shell';
        public static print:void(data:string){
            var d:string{}=[type:'print',data:data];
            vm 'out %oper %d';
        }
        public static input:string(){
            var d:string{}=[type:'input'];
            vm 'out %oper %d';
            var ret:string;
            vm 'in %oper %ret';
            return ret;
        }
        public static exec:boolean(command:string){
            var d:string{}=[type:'shell',data:command];
            vm 'out %oper %d';
            var ret:boolean;
            vm 'in %oper %ret';
            return ret;
        }
    }
}
