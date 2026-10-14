Component({
 data:{selected:0,tabs:[{path:'index',icon:'notebook',text:'工作台'},{path:'residents',icon:'folder',text:'居民档案'},{path:'priority',icon:'list',text:'重点筛选'},{path:'stats',icon:'chart',text:'服务统计'}]},
 methods:{switchTab(e){wx.switchTab({url:'/pages/'+e.currentTarget.dataset.path+'/index'});}}
});
