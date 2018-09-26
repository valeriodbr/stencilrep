declare module 'postcss' {

  function postcss(arg: any): any;

  namespace postcss {
    type Plugin<T> = any;
    type Transformer = any;
  }

  export = postcss;
}