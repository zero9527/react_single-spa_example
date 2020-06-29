# create-react-app 使用 single-spa-react 改造

## 前言
其实方便点可以使用 [qiankun](https://qiankun.umijs.org/zh/) 的微前端方案

依赖版本：
```json
"single-spa": "^5.5.2",
"single-spa-react": "^2.14.0",
```

- 本文主应用(Vue)：[json-util](https://github.com/zero9527/json-util)，进去后路由手动切到 `/sub-app` 就能看到了，这里时钟和日历是 `Vue` 项目作为子应用，另一个就是 `React` 项目作为子应用

- 子应用(React)：[react_single-spa_example](https://github.com/zero9527/react_single-spa_example.git)

- 主应用(React)：可以看这里 [md-note](https://github.com/zero9527/md-note)，这里用到 `Vue` 项目作为子应用，没有用到 `React` 项目作为子应用


## 流程
### 主应用流程(Vue)
- 启动由 `system.js` 接管，配置 `webpack` 下 `output.libraryTarget` 为 `system`

- `html` 入口中通过 `importmap`，设置当前应用、子应用 名称+地址

- 一般用法（`DOM` 节点一直存在的情况下）：`registerApplication` 注册子应用，通过 `system.js` 引入，设置渲染路由 `activeWhen`，传递给子应用的参数 `customProps`

- 使用 `Parcel` 用法（`DOM` 节点不是一直存在的情况下）：
  - 主应用也需要包裹 `singleSpaVue/singleSpaReact` 等，
  - 然后 `registerApplication` 自己，
  - 在某个组件（A）内使用由 `main.js/ts` 在 `bootstraps/mount` 时导出的 `mountParcel`，
  - 在某组件（A）挂载后，手动将子应用（当做组件用）挂载到这个组件的某个 `DOM` 节点（见1.6）

### 子应用流程(React)
- 启动方式由 `single-spa-react` 接管，可以判断 `window.singleSpaNavigate` 为 `false` 单独启动

- 配置在主应用的挂载点，`domElementGetter` 返回一个 `DOM` 节点，默认挂载到 `body` 下（使用 `Parcel` 的话就不需要配置）

- 导出一些生命周期事件，至少如下三个：`bootstrap/mount/unmount`，可以在 `mount` 下接收主应用传递的参数

- 设置子应用的 `publicPath`：
  - `systemjs-webpack-interop` 设置 `setPublicPath`；记住名称要与主应用引入的一致


## 1、主应用(Vue)

> 主应用使用 `Parcel` 引用子应用时，需要自身使用 `single-spa-react`

### 1.1 下载依赖
```shell
yarn add single-spa
```

### 1.2 配置
#### single-spa-config.ts
在 src 下创建  single-spa-config.ts 文件

这里注意为什么包一层函数，因为 `tree-shaking` 的原因！！！

> 如果不包裹，在导入的地方 `import '@/single-spa-config.ts'` 打包后就没了，**但是开发环境还是在的，可以正常运行！！！**
 
```js
// src/single-spa-config.ts
import { registerApplication, start } from 'single-spa';

export default function singleSpaSetup() {
  // 改为 Parcel 手动挂载子应用了，需要导出 mountParcel，已经用 singleVue 包裹了，所以要用 registerApplication 启动
  registerApplication({
    name: 'root-config',
    app: () => (window as any).System.import('root-config'),
    activeWhen: () => true,
  });

  start();
}
```


### 1.3 修改 webpack
#### Access-Control-Allow-Origin
开发环境添加 headers：
```js
// vue.config.js
configureWebpack: config => {
  config.output.libraryTarget = 'system';

  config.devServer = {
    port: 666,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    disableHostCheck: true,
    historyApiFallback: true,
  };
},
```

#### libraryTarget
将 `output.libraryTarget` 改为 `system`

#### 去掉文件 hash
```js
// vue.config.js
filenameHashing: false,
```

### 1.4 HTML 入口
```html
<!-- public/index.html -->
<meta name="importmap-type" content="systemjs-importmap" />
<script type="systemjs-importmap">
  <%= htmlWebpackPlugin.options.systemJsImportmap %>
</script>
<script src="./libs/systemjs/system.min.js"></script>
<script src="./libs/systemjs/extras/amd.min.js"></script>
<script src="./libs/systemjs/extras/named-exports.min.js"></script>
<script src="./libs/systemjs/extras/named-register.min.js"></script>
<script src="./libs/systemjs/extras/use-default.min.js"></script>
<script>
  System.import('root-config');
</script>
```

### 1.5 webpack 配置自动导入
#### 新建一个 `systemJs-Importmap.js`

里面就像这样
```js
// systemJs-Importmap.js
const isEnvDev = process.env.NODE_ENV === 'development';

// systemjs-importmap 的配置，通过webpack给html用
module.exports = [
  {
    name: 'root-config',
    entry: './js/app.js',
  },
  {
    name: '@vue-mf/calendar',
    entry: isEnvDev
      ? '//zero9527.site/vue-calendar/js/app.js' // '//localhost:2333/js/app.js'
      : '//zero9527.site/vue-calendar/js/app.js',
  },
  {
    name: '@vue-mf/clock',
    entry: isEnvDev
      ? '//zero9527.site/vue-clock/js/app.js' // '//localhost:2334/js/app.js'
      : '//zero9527.site/vue-clock/js/app.js',
  },
  {
    name: '@react-mf/test',
    entry: isEnvDev
      ? '//localhost:2335/js/app.js'
      : 'https://zero9527.github.io/clock/js/app.js',
  },
];
```

#### 配置 externals
> **注意！**
> 如果设置了 `externals`，第三方包就不能通 `script` 的方式引入了，要用 `systemjs-importmap` 的方式引入（可以看看这个项目的配置 [md-note](https://github.com/zero9527/md-note)）


#### 配置 html-webpack-plugin 参数
可以是直接在 `options` 下增加参数，也可以 `templateParameters`，
区别是 `templateParameters` 可以直接在 `HTML入口` 引用，而 `options` 的话就要带一串东西

> `templateParameters` 很方便，但是不好加参数，还是 `options` 好加

- html 引入

```html
<script type="systemjs-importmap">
  <%= htmlWebpackPlugin.options.systemJsImportmap %>
</script>
```

- 修改 htmlWebpackPlugin
```js
// vue.config.js
chainWebpack: config => {
  config.plugin('html').tap(args => {
    const importMap = { imports: {} };
    systemJsImportmap.forEach(item => (importMap.imports[item.name] = item.entry));
    args[0].systemJsImportmap = JSON.stringify(importMap, null, 2);
    return args;
  });
},
```


### 1.6 启动 single-spa
#### 子应用 Appliaction
> **注意！**<br>
> `DOM` 节点应该一直存在（如果在子应用那里设置了挂载节点 `el` 的话，默认挂载在 `body` 下面），不然放在某个组件下面，第一次进入正常，但是再回来就会报错，找不到 `el` 的那个节点，

> **上面这种情况其实应该用 `Parcel`**

项目入口如 `src/main.ts` 引入 `single-spa-config.ts` ，然后执行;

```js
// src/single-spa-config.ts
import { registerApplication, start } from 'single-spa';

export default function singleSpaSetup() {
  // 改为 Parcel 手动挂载子应用了，需要导出 mountParcel，已经用 singleVue 包裹了，所以要用 registerApplication 启动
  registerApplication({
    name: 'root-config',
    app: () => (window as any).System.import('root-config'),
    activeWhen: () => true,
  });

  start();
}
```

#### 子应用 Parcel
[官方文档](https://single-spa.js.org/docs/parcels-overview/)

> 翻译过来叫：包裹，可以在主应用将一个子应用当做组件，手动挂载、卸载使用，不限框架，webpack 5 有一个 Module Federation 也是可以跨项目使用组件的，更细粒化

使用 `Parcel` 用法（`DOM` 节点不是一直存在的情况下）：
- 主应用也需要包裹 `singleSpaVue/singleSpaReact` 等，
- 然后 `registerApplication` 自己，
- 在某个组件（A）内使用由 `main.js/ts` 在 `bootstraps/mount` 时导出的 `mountParcel`，
- 在某组件（A）挂载后，手动将子应用（当做组件用）挂载到这个组件的某个 `DOM` 节点

#### 下载 single-spa-vue

```shell
yarn add single-spa-vue
```

#### 主应用入口 src/main.ts

```js
// src\main.ts
import Vue from 'vue';
import singleSpaVue from 'single-spa-vue';
import VueCompositionApi from '@vue/composition-api';
import singleSpaSetup from '@/single-spa-config';
import Iconfont from '@/components/Iconfont/index.vue';
import router from './router';
import App from './App.vue';

singleSpaSetup();
Vue.use(VueCompositionApi);
Vue.component('icon-font', Iconfont);

Vue.config.productionTip = false;

// **************** 主应用一般写法 ****************
// // 子应用 registerAppliaction 注册
// new Vue({
//   router,
//   render: (h: any) => h(App),
// }).$mount('#json-util');

// **************** 主应用使用 Parcel 写法 ****************
// 主应用使用 Parcel 挂载子应用（某组件下）的时候的写法
// 需要把当前应用当做子应用，然后 registerAppliaction 调用
const singleSpa = singleSpaVue({
  Vue,
  appOptions: {
    el: '#json-util',
    render: (h: any) => h(App),
    router,
  },
});

// eslint-disable-next-line
export let mountParcel: any;

export const bootstrap = (props: any) => {
  mountParcel = props.mountParcel;
  return singleSpa.bootstrap(props);
};

export const { mount, unmount } = singleSpa;
```

- 主应用在需要使用子应用的地方

src\views\SubApp\index.vue
```html
<template>
  <div class="sub-app">
    <h3>sub-app</h3>
    <div id="app-clock" />
    <div id="app-calendar" />
    <div id="app-reacttest" />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from '@vue/composition-api';
import { mountParcel } from '@/main';

export default defineComponent({
  name: 'SubApp',
  setup() {
    onMounted(() => {
      mountParcelHandler('@vue-mf/clock', 'app-clock');
      // mountParcelHandler('@vue-mf/calendar', 'app-calendar');
      mountParcelHandler('@react-mf/test', 'app-reacttest');
    });

    const mountParcelHandler = (appName: string, domElementId: string) => {
      const parcelConfig = (window as any).System.import(appName);
      const domElement = document.getElementById(domElementId);
      mountParcel(parcelConfig, { domElement });
    };
  },
});
</script>

<style lang="less"></style>
```

## 2、子应用配置(React)
### 2.1 下载依赖
- single-spa-react

```shell
yarn add single-spa-react
```

- systemjs-webpack-interop

```shell
yarn add systemjs-webpack-interop
```

- react-app-rewired

```shell
yarn add -D react-app-rewired
```

### 2.2 应用入口 src/index.tsx
```tsx
import './set-public-path';
import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';
import * as serviceWorker from './serviceWorker';
import App from './App';
import './index.css';

if (!(window as any).singleSpaNavigate) {
  ReactDOM.render(<App />, document.getElementById('root'));
}

const domElementGetter = () => {
  return document.getElementById('root')!;
};

// =========== single-spa模式 ===========
const reactLifecycles = singleSpaReact({
  React,
  ReactDOM,
  domElementGetter,
  rootComponent: () => <App />,
});

export const { bootstrap, mount, unmount } = reactLifecycles;

serviceWorker.unregister();
```

### 2.3 设置 publicPath
> 注意 **名称** 要与主应用引入的一致

```js
// src\set-public-path.ts
import { setPublicPath } from 'systemjs-webpack-interop';

if ((window as any).singleSpaNavigate) {
  setPublicPath('@react-mf/test', 2);
}
```


### 2.4 修改 webpack 配置
使用 `react-app-rewired` 配置

#### config-overrides.js
```js
// config-overrides.js
const path = require('path');

const pathResolve = (_path) => path.resolve(__dirname, _path);

process.env.PORT = 2335;

// react-app-rewired: webpack配置覆盖
module.exports = {
  webpack: function override(config, env) {
    config.entry = pathResolve('src/index.tsx');

    config.resolve.alias = {
      ...config.resolve.alias,
      '@': pathResolve('src'),
    };

    config.output = {
      ...config.output,
      publicPath: '',
      libraryTarget: 'system',
      filename: 'js/app.js',
      chunkFilename: 'js/[name].[contenthash:8].js',
    };

    // console.log(config.output);
    // process.exit(1);

    delete config.optimization;

    return config;
  },
  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);

      return {
        ...config,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        disableHostCheck: true,
        sockHost: 'localhost',
        sockPort: 2335,
        port: 2335,
        hot: true,
      };
    };
  },
  paths: function (paths, env) {
    return paths;
  },
  jest: function (config) {
    if (!config.testPathIgnorePatterns) {
      config.testPathIgnorePatterns = [];
    }
    if (!process.env.RUN_COMPONENT_TESTS) {
      config.testPathIgnorePatterns.push(
        '<rootDir>/src/components/**/*.test.js'
      );
    }
    if (!process.env.RUN_REDUCER_TESTS) {
      config.testPathIgnorePatterns.push('<rootDir>/src/reducers/**/*.test.js');
    }
    return config;
  },
};
```
