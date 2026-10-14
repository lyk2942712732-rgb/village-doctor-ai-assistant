const config = require('./config');
App({ globalData:{profile:null,demo:false}, onLaunch(){wx.removeStorageSync('village-doctor-demo-v1');if(config.env && wx.cloud) wx.cloud.init({env:config.env,traceUser:true});} });

