// Test-only Electron host. The full launcher/tray is tested separately afterwards.
// No production profile, login, updater, renderer assets or external networking.
const {app,BrowserWindow,session}=require('electron');
let win; // Keep the hidden fixture window alive until explicit shutdown.
app.whenReady().then(async()=>{
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/i.test(details.url)}));
 win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadURL('about:blank');
}).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
