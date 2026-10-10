import { test } from './browser-session';
import { expect } from '@playwright/test';
test('C01 decline question returns premise plus actionable sourced diagnosis',async({page,request})=>{
  const {items}=await (await request.get('/api/datasets')).json();const dataset=items.find((d:{version:string})=>d.version==='kasirnusa-2026-10-01');
  expect(dataset).toBeTruthy();const accounts=await (await request.get('/api/accounts?dataset_id='+dataset.id+'&page_size=100')).json();const account=accounts.items.find((a:{externalId:string})=>a.externalId==='C01');
  await page.goto('/accounts/'+account.id+'?dataset_id='+dataset.id);
  const qa=page.getByRole('region',{name:'Account questions'});
  await qa.getByRole('textbox',{name:'Account question',exact:true}).fill('Why are repeat orders lower?');await qa.getByRole('button',{name:'Ask account question'}).click();
  await expect(qa.getByRole('heading',{name:/Question premise:/})).toContainText('insufficient data');
  await expect(qa).toContainText('Documented findings');await expect(qa).toContainText('renewal');
  await expect(qa).toContainText('integration');await expect(qa).toContainText('remediation');
  await qa.getByRole('button',{name:'I0331',exact:true}).first().click();await expect(page.getByRole('complementary',{name:'Original source'})).toContainText('I0331');
  await page.getByRole('button',{name:'Close source'}).click();
  await qa.getByRole('combobox',{name:'Answer language'}).selectOption('id');
  await qa.getByRole('textbox',{name:'Account question',exact:true}).fill('Buatkan draft follow-up');await qa.getByRole('button',{name:'Ask account question'}).click();
  await expect(qa).toContainText('Temuan terdokumentasi');const draft=qa.getByRole('textbox',{name:'Editable answer draft'});await expect(draft).toBeVisible();await draft.fill('Reviewed draft');await expect(draft).toHaveValue('Reviewed draft');
  await expect(qa.getByRole('button',{name:/^send/i})).toHaveCount(0);
});
test('C06 question computes a value and requires clarification for cross-account references',async({page,request})=>{
  const {items}=await (await request.get('/api/datasets')).json();const dataset=items.find((d:{version:string})=>d.version==='kasirnusa-2026-10-01');
  await page.goto('/opportunities?dataset_id='+dataset.id);await page.getByRole('link',{name:/C06 ·/}).click();const qa=page.getByRole('region',{name:'Account questions'});
  await qa.getByRole('textbox',{name:'Account question',exact:true}).fill('Kalau tambah 10 outlet, berapa nilai tahunannya?');await qa.getByRole('button',{name:'Ask account question'}).click();await expect(qa).toContainText('37800000.00 IDR');
  await qa.getByRole('textbox',{name:'Account question',exact:true}).fill('Who approves for P01?');await qa.getByRole('button',{name:'Ask account question'}).click();await expect(qa).toContainText('clarification required');await expect(qa).not.toContainText('Rina');
});
