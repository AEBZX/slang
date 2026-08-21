public std:module{
    public file:module{
        //提前缓存部分常量节省性能
        public static homedir:string=null;
        public static cwd:string=null;
        public static const:string{}=[
            text:'text',bin:'bin',
            all:'all',file:'file',folder:'folder'
        ];
        //类操作
        public File:class{
            public path:string;
            public constructor:(path:string){
                this.path=path;
            }
            public readText:string(){
                var d:string{}=[type:const['read'],name:this.path,mode:const['text']];
                vm 'out %type %d';
                var ret:string=null;
                vm 'in %type %ret';
                return ret;
            }
            public readBin:number[]{
                var d:string{}=[type:const['read'],name:this.path,mode:const['bin']];
                vm 'out %type %d';
                var ret:number[]=null;
                vm 'in %type %ret';
                return ret;
            }
            public writeText:boolean(data:string){
                var d:string{}=[type:const['write'],name:this.path,mode:const['text']];
                vm 'out %type %d';
                var ret:boolean=null;
                vm 'in %type %ret';
                return ret;
            }
            public writeBin:boolean(data:number[]){
                var d:string{}=[type:const['write'],name:this.path,mode:const['bin']];
                vm 'out %type %d';
                var ret:boolean=null;
                vm 'in %type %ret';
                return ret;
            }
            public isFile:boolean(){
                var d:string{}=[type:'exist',name:this.path,mode:'file'];
                vm 'out %type %d';
                var ret:boolean=null;
                vm 'in %type %ret';
                return ret;
            }
            public isFolder:boolean(){
                var d:string{}=[type:'exist',name:this.path,mode:'folder'];
                vm 'out %type %d';
                var ret:boolean=null;
                vm 'in %type %ret';
                return ret;
            }
            public delete:boolean(){
                var d:string{}=[type:'delete',name:this.path,mode:'all'];
                vm 'out %type %d';
                var ret:boolean=null;
                vm 'in %type %ret';
                return ret;
            }
            public exists:boolean(){
                var d:string{}=[type:'exist',name:this.path,mode:'all'];
                vm 'out %type %d';
                var ret:boolean=null;
                vm 'in %type %ret';
                return ret;
            }
        }
        public static type:string='file';
        public static readText:string(dir:string){
            var d:string{}=[type:const['read'],name:dir,mode:const['text']];
            vm 'out %type %d';
            var ret:string=null;
            vm 'in %type %ret';
            return ret;
        }
        public static readBin:number[](dir:string){
            var d:string{}=[type:const['read'],name:dir,mode:const['bin']];
            vm 'out %type %d';
            var ret:number[]=null;
            vm 'in %type %ret';
            return ret;
        }
        public static writeText:boolean(dir:string,data:string){
            var d:string{}=[type:const['write'],name:dir,mode:const['text']];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static writeBin:boolean(dir:string,data:number[]){
            var d:string{}=[type:const['write'],name:dir,mode:const['bin'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static mkdir:boolean(dir:string){
            var d:string{}=[type:'create',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static rmdir:boolean(dir:string){
            var d:string{}=[type:'delete',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static rm:boolean(dir:string){
            var d:string{}=[type:'delete',name:dir,mode:'all'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static createFile:boolean(dir:string){
            var d:string{}=[type:'create',name:dir,mode:'file'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static exists:boolean(dir:string){
            var d:string{}=[type:'exist',name:dir,mode:'all'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static ifFile:boolean(dir:string){
            var d:string{}=[type:'exist',name:dir,mode:'file'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static ifFolder:boolean(dir:string){
            var d:string{}=[type:'exist',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:boolean=null;
            vm 'in %type %ret';
            return ret;
        }
        public static dir:string[](dir:string){
            var d:string{}=[type:'find',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:string[]=null;
            vm 'in %type %ret';
            return ret;
        }
        public static get_cwd(){
            if(cwd)return cwd;
            var d:string=[type:dir,name:'cwd'];
            vm 'out %type %d';
            var ret:string=null;
            vm 'in %type %ret';
            cwd=ret;
            return cwd;
        }
        public static get_homedir(){
            if(homedir)return homedir;
            var d:string=[type:const['dir'],name:'home'];
            vm 'out %type %d';
            var ret:string=null;
            vm 'in %type %ret';
            homedir=ret;
            return homedir;
        }
    }
}