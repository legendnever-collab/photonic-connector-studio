import type { Page } from '@playwright/test';
export async function tab(page:Page,name:string){
 const mapped=({Train:'Surfaces',Edit:'Inspect',Analyze:'Analysis','Ray Analysis':'Analysis'} as Record<string,string>)[name]??name;
 const mobile=page.getByRole('navigation',{name:'Surface Workspace tabs'});
 if(await mobile.isVisible())await mobile.getByRole('button',{name:mapped,exact:true}).click();
 else if(mapped==='Analysis'||mapped==='Inspect'){if(!await page.getByRole('navigation',{name:'Surface Inspector tabs'}).isVisible())await page.getByRole('button',{name:'Properties / Analysis',exact:true}).click();await page.getByRole('navigation',{name:'Surface Inspector tabs'}).getByRole('button',{name:mapped,exact:true}).click();}
 if(mapped==='Surfaces'){if(!await page.getByLabel('Project Example',{exact:true}).isVisible())await page.getByRole('button',{name:'검증용 예시',exact:true}).click();if(!await mobile.isVisible()&&!await page.getByTestId('panel-data').isVisible())await page.getByRole('button',{name:'Surface Data',exact:true}).click();}
}
export async function idealExample(page:Page,id:string){await openProjectExample(page,'ideal:'+id);}
export async function selectIdeal(page:Page,id:string){await tab(page,'Train');await page.getByTestId('tree-'+id).click();}

export async function acceptProjectReplacement(page:Page){const dialog=page.getByRole('dialog',{name:'Unsaved Project',exact:true});if(await dialog.isVisible())await dialog.getByRole('button',{name:'Discard & Open',exact:true}).click();}

export async function openProjectExample(page:Page,id:string){await tab(page,'Surfaces');await page.getByLabel('Project Example',{exact:true}).selectOption(id);await acceptProjectReplacement(page);await tab(page,'Layout');}

export async function openTechnicalExamples(page:Page){await tab(page,'Surfaces');}
