declare module 'terser/dist/browser.bundle.js' {

  namespace Terser {
    function minify(input: any, b: any): any;
  }

  export = Terser;
}