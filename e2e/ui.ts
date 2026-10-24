import type { Page } from '@playwright/test';
export async function tab(page:Page,name:string){
 const mapped=({Train:'Surfaces',Edit:'Inspect',Analyze:'Analysis','Ray Analysis':'Analysis'} as Record<string,string>)[name]??name;
 const mobile=page.getByRole('navigation',{name:'Surface Workspace tabs'});
 if(await mobile.isVisible())await mobile.getByRole('button',{name:mapped,exact:true}).click();
 else if(mapped==='Analysis'||mapped==='Inspect')await page.getByRole('navigation',{name:'Surface Inspector tabs'}).getByRole('button',{name:mapped,exact:true}).click();
}
export async function idealExample(page:Page,id:string){await tab(page,'Layout');await page.getByLabel('Project Example',{exact:true}).selectOption('ideal:'+id);}
export async function selectIdeal(page:Page,id:string){await tab(page,'Train');await page.getByTestId('tree-'+id).click();}
