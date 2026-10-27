import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'test/ui',testMatch:'*.spec.js',workers:1,timeout:45000,
  use:{baseURL:'http://localhost:4178',headless:true,
    ...(process.env.SALES_TEST_CHROMIUM?{launchOptions:{executablePath:process.env.SALES_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}}:{}),
  },
  webServer:{command:'node test/ui/server.mjs',url:'http://localhost:4178/cats/',reuseExistingServer:false,timeout:60000},
});
