const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'temka-news-'));
 const args=[path.resolve(__dirname,'..'),'--disable-gpu',`--user-data-dir=${profile}`];
 if(process.platform==='linux')args.push('--no-sandbox'); // Isolated CI only, never a production launch flag.
 const app=await electron.launch({args,timeout:60000});let passed=0;
 const check=(name,condition)=>{assert(condition,name);passed++;console.log('PASS',name);};
 try {
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  await page.setViewportSize({width:1280,height:900});
  await page.getByPlaceholder('Temka_Игрок').fill('temka_play_official');
  await page.getByPlaceholder('you@example.com').fill('owner-test@example.invalid');
  await page.locator('input[type=password]').nth(0).fill('TestOnly123!');await page.locator('input[type=password]').nth(1).fill('TestOnly123!');
  await page.getByRole('button',{name:/Принимаю правила/}).click();await page.getByRole('button',{name:/Создать аккаунт/}).click();
  await page.getByRole('button',{name:'Профиль',exact:true}).click();
  const badge=page.locator('[data-profile-badge]');await badge.waitFor();
  check('Owner sees Developer rather than Newbie in profile header',(await badge.textContent()).trim()==='Разработчик');
  check('Local signature limitation is explicit',(await badge.getAttribute('title')).includes('не подтверждение онлайн-прав'));
  check('Header no longer claims a server connection',await page.locator('header').getByText('локальный профиль',{exact:true}).isVisible());
  check('Sidebar shows local developer signature',await page.getByText('Разработчик · локально',{exact:true}).isVisible());
  check('Game title data is not promoted or overwritten',await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('temka-accounts-v1'));return s.users.find(u=>u.id===s.session).profile.title==='newbie';}));
  await page.getByLabel('Загрузить свою аватарку',{exact:true}).setInputFiles(path.resolve(__dirname,'../assets/icon.png'));
  await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('temka-accounts-v1'));return s.users.find(u=>u.id===s.session).profile.avatar.startsWith('data:image/webp;base64,');});
  const imageBefore=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('temka-accounts-v1'));return s.users.find(u=>u.id===s.session).profile.avatar;});
  await page.locator('input[maxlength="25"]').last().fill('AnotherPlayer');await page.getByRole('button',{name:'Сохранить',exact:true}).first().click();
  check('Ordinary player has Player badge',(await badge.textContent()).trim()==='Игрок');
  await page.locator('input[maxlength="25"]').last().fill('temka_play_official');await page.getByRole('button',{name:'Сохранить',exact:true}).first().click();
  check('Restoring exact owner name restores display signature',(await badge.textContent()).trim()==='Разработчик');
  check('Owner setup guide removed from profile',await page.getByText('Как включить друзей и письма? · для владельца проекта',{exact:true}).count()===0);
  check('SQL controls removed',await page.getByRole('button',{name:'Показать SQL',exact:true}).count()===0);
  await page.getByRole('button',{name:'Новости',exact:true}).click();
  await page.getByRole('heading',{name:'Что нового?',exact:true}).waitFor();
  check('History contains eight build notes',await page.locator('[data-release]').count()===8);
  check('Current history version matches package',await page.locator(`[data-release="${require('../package.json').version}"]`).count()===1);
  check('Fake first-news subscription removed',await page.getByRole('button',{name:'Сообщить о первой новости'}).count()===0);
  for(const [name,kind] of [['Добавлено','added'],['Исправлено','fixed'],['Убрано','removed']]){
   await page.getByRole('button',{name,exact:true}).click();
   check(`${name} filter works`,await page.locator('[data-change-kind]').evaluateAll((nodes,k)=>nodes.length>0&&nodes.every(n=>n.dataset.changeKind===k),kind));
  }
  await page.getByRole('button',{name:'Все',exact:true}).click();await page.getByRole('searchbox',{name:'Поиск по изменениям'}).fill('1.5.3');
  check('Search by version works',await page.locator('[data-release]').count()===1&&await page.locator('[data-release]').getAttribute('data-release')==='1.5.3');
  await page.getByRole('searchbox',{name:'Поиск по изменениям'}).fill('Ничего_такого_нет');await page.getByRole('heading',{name:'Ничего не найдено'}).waitFor();
  check('No search matches has an honest empty state',await page.locator('[data-release]').count()===0);
  await page.getByRole('button',{name:'Сбросить фильтры'}).click();check('Reset restores all notes',await page.locator('[data-release]').count()===8);
  if(process.env.TEMKA_SCREENSHOTS){fs.mkdirSync(process.env.TEMKA_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.TEMKA_SCREENSHOTS,'news-154.png')});}
  await page.setViewportSize({width:980,height:700});check('News does not overflow compact viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.getByRole('button',{name:'Профиль',exact:true}).click();await badge.waitFor();
  check('Creator signature survives restart',(await badge.textContent()).trim()==='Разработчик');
  check('Custom avatar and local account preserved',await page.evaluate(img=>{const s=JSON.parse(localStorage.getItem('temka-accounts-v1'));return s.users.find(u=>u.id===s.session).profile.avatar===img;},imageBefore));
  if(process.env.TEMKA_SCREENSHOTS){await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(process.env.TEMKA_SCREENSHOTS,'creator-154.png')});}
  check('No renderer errors',errors.length===0);
  console.log(`ALL ${passed} NEWS / CREATOR / GUIDE UI CHECKS PASSED`);
 } finally {await app.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1)});
