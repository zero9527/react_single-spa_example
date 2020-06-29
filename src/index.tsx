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
