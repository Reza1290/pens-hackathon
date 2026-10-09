import { test,expect,type APIRequestContext } from '@playwright/test';
// Read-only journeys against the locally imported, source-verified snapshot.
// These tests do not import customer data, send messages or change the database.
async function context(request:APIRequestContext){
  const response=await request.get('/api/datasets');expect(response.ok()).toBeTruthy();
  const {items}=await response.json();const dataset=items.find((d:{version:string})=>d.version==='kasirnusa-2026-10-01');
  if(!dataset)throw new Error('Prepare the kasirnusa-2026-10-01 snapshot and run data:analyze + data:diagnose before test:e2e');
  const accounts=await (await request.get('/api/accounts?dataset_id='+dataset.id+'&page_size=100')).json();
  return {dataset,accounts:accounts.items as {id:string;externalId:string}[]};
}
test('C06 opportunity to original evidence, action and editable template',async({page,request})=>{
  const {dataset}=await context(request);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?dataset_id='+dataset.id);
  await page.getByRole('link',{name:/C06 ·/}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('C06');
  await expect(page.getByRole('heading',{name:'Relationship path'})).toBeVisible();
  await page.getByRole('button',{name:'I0300',exact:true}).first().click();
  const source=page.getByRole('complementary',{name:'Original source'});
  await expect(source).toContainText('I0300');await expect(source).toBeFocused();
  await source.getByRole('button',{name:'Close source'}).click();
  await page.getByRole('link',{name:'Action plan',exact:true}).click();
  await page.getByRole('button',{name:'Prepare draft'}).click();
  const draft=page.getByRole('textbox',{name:'Editable follow-up draft'});
  await expect(draft).toHaveValue(/I0300/);await draft.fill('Edited by the account manager.');await expect(draft).toHaveValue('Edited by the account manager.');
  await expect(page.getByRole('button',{name:/^send/i})).toHaveCount(0);
  await page.screenshot({path:'artifacts/phase-4-desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('C01 premise and renewal context; P01 routes clear previous drafts',async({page,request})=>{
  const {dataset,accounts}=await context(request);const c01=accounts.find(a=>a.externalId==='C01')!;const p01=accounts.find(a=>a.externalId==='P01')!;
  await page.goto('/accounts/'+c01.id+'?dataset_id='+dataset.id);
  await expect(page.getByRole('main')).toContainText('renewal');
  await expect(page.getByRole('main')).toContainText('Historical');
  await page.getByRole('textbox',{name:'Check an outcome question'}).fill('Why are repeat orders lower?');await page.getByRole('button',{name:'Check premise'}).click();
  await expect(page.getByRole('heading',{name:/Premise check:/})).toContainText('insufficient data');
  await page.getByRole('link',{name:'Action plan',exact:true}).click();await page.getByRole('button',{name:'Prepare draft'}).click();await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toBeVisible();
  await page.getByRole('combobox',{name:'Investigate account'}).selectOption(p01.id);
  await expect(page.getByRole('heading',{level:1})).toContainText('P01');
  await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toHaveCount(0);
  await page.getByRole('link',{name:'Action plan',exact:true}).click();
  await expect(page.getByRole('main')).toContainText('new sale');
  await page.getByRole('combobox',{name:'Conversation route'}).selectOption('intermediary');
  await expect(page.getByRole('main')).toContainText('prepare through intermediary');
  await page.getByRole('button',{name:'Prepare draft'}).click();await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toBeVisible();
  await page.getByRole('combobox',{name:'Conversation route'}).selectOption('joint');
  await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/phase-4-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('unavailable resources and API failures are readable; keyboard reaches content',async({page,request})=>{
  const {dataset}=await context(request);
  await page.goto('/opportunities/00000000-0000-4000-8000-000000000001?dataset_id='+dataset.id);
  await expect(page.getByRole('alert')).toContainText('404');
  await page.goto('/?dataset_id='+dataset.id);await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.route('**/api/opportunities?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Operation unavailable'})}));
  await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('cancelled');await expect(page.getByRole('alert')).toContainText('503');
});
test('switching snapshots clears account and draft state',async({page,request})=>{
  const {dataset,accounts}=await context(request);const c01=accounts.find(a=>a.externalId==='C01')!;
  const other={...dataset,id:'00000000-0000-4000-8000-000000000002',version:'synthetic-empty-snapshot'};
  await page.route('**/api/datasets',r=>r.fulfill({json:{items:[dataset,other]}}));
  await page.route('**/api/accounts?*',r=>new URL(r.request().url()).searchParams.get('dataset_id')===other.id?r.fulfill({json:{items:[]}}):r.continue());
  await page.route('**/api/opportunities?*',r=>new URL(r.request().url()).searchParams.get('dataset_id')===other.id?r.fulfill({json:{total:0,items:[]}}):r.continue());
  await page.goto('/accounts/'+c01.id+'/action?dataset_id='+dataset.id);
  await page.getByRole('button',{name:'Prepare draft'}).click();await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toBeVisible();
  await page.getByRole('combobox',{name:'Snapshot',exact:true}).selectOption(other.id);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Expansion opportunities');
  await expect(page.getByRole('combobox',{name:'Investigate account'})).toHaveValue('');
  await expect(page.getByRole('textbox',{name:'Editable follow-up draft'})).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText('No opportunities match');
  await expect(page).toHaveURL(new RegExp(other.id));
});
