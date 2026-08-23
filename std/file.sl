public std:module{
    public file:module{
        //提前缓存部分常量节省性能
        public static homedir:var:string;
        public static cwd:var:string;
        public static const:var:string{}=[
            text:'text',bin:'bin',
            all:'all',file:'file',folder:'folder',
            read:'read',write:'write',exist:'exist',
            delete:'delete',create:'create',find:'find',dir:'dir'
        ];
        //类操作
        public File:class{
            public path:var:string;
            public constructor:void(path:string){
                this.path=path;
            }
            public readText:string(){
                var d:string{}=[type:std.file.const['read'],name:this.path,mode:std.file.const['text']];
                vm 'out %type %d';
                var ret:string;
                vm 'in %type %ret';
                return ret;
            }
            public writeText:boolean(data:string){
                var d:string{}=[type:std.file.const['write'],name:this.path,mode:std.file.const['text'],data:data];
                vm 'out %type %d';
                var ret:boolean;
                vm 'in %type %ret';
                return ret;
            }
            public isFile:boolean(){
                var d:string{}=[type:'exist',name:this.path,mode:'file'];
                vm 'out %type %d';
                var ret:boolean;
                vm 'in %type %ret';
                return ret;
            }
            public isFolder:boolean(){
                var d:string{}=[type:'exist',name:this.path,mode:'folder'];
                vm 'out %type %d';
                var ret:boolean;
                vm 'in %type %ret';
                return ret;
            }
            public delete:boolean(){
                var d:string{}=[type:'delete',name:this.path,mode:'all'];
                vm 'out %type %d';
                var ret:boolean;
                vm 'in %type %ret';
                return ret;
            }
            public exists:boolean(){
                var d:string{}=[type:'exist',name:this.path,mode:'all'];
                vm 'out %type %d';
                var ret:boolean;
                vm 'in %type %ret';
                return ret;
            }
        }
        public static type:var:string='file';
        public static readText:string(dir:string){
            var d:string{}=[type:std.file.const['read'],name:dir,mode:std.file.const['text']];
            vm 'out %type %d';
            var ret:string;
            vm 'in %type %ret';
            return ret;
        }
        public static writeText:boolean(dir:string,data:string){
            var d:string{}=[type:std.file.const['write'],name:dir,mode:std.file.const['text'],data:data];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static mkdir:boolean(dir:string){
            var d:string{}=[type:'create',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static rmdir:boolean(dir:string){
            var d:string{}=[type:'delete',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static rm:boolean(dir:string){
            var d:string{}=[type:'delete',name:dir,mode:'all'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static createFile:boolean(dir:string){
            var d:string{}=[type:'create',name:dir,mode:'file'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static exists:boolean(dir:string){
            var d:string{}=[type:'exist',name:dir,mode:'all'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static ifFile:boolean(dir:string){
            var d:string{}=[type:'exist',name:dir,mode:'file'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static ifFolder:boolean(dir:string){
            var d:string{}=[type:'exist',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:boolean;
            vm 'in %type %ret';
            return ret;
        }
        public static dir:string[](dir:string){
            var d:string{}=[type:'find',name:dir,mode:'folder'];
            vm 'out %type %d';
            var ret:string[];
            vm 'in %type %ret';
            return ret;
        }
        public static get_cwd:string(){
            var d:string{}=[type:'dir',name:'cwd'];
            vm 'out %type %d';
            var ret:string;
            vm 'in %type %ret';
            std.file.cwd=ret;
            return ret;
        }
        public static get_homedir:string(){
            var d:string{}=[type:'dir',name:'home'];
            vm 'out %type %d';
            var ret:string;
            vm 'in %type %ret';
            std.file.homedir=ret;
            return ret;
        }
    }
}
