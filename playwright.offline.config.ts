import config from './playwright.config';
import {defineConfig} from '@playwright/test';
// Packaged HTML checks need no preview service or network.
export default defineConfig({...config,webServer:undefined,projects:config.projects?.filter(p=>p.name==='desktop'),testMatch:['**/physicalGaussian.spec.ts','**/asphere.spec.ts','**/routing.spec.ts','**/search.spec.ts','**/foldedGaussian.spec.ts','**/lensDesign.spec.ts','**/reportDetails.spec.ts','**/designProblem.spec.ts']});
