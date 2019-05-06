import * as d from '../../../declarations';
import { sortBundleComponents } from '../generate-lazy-module';


describe('sortBundleComponents', () => {

  it('sort bundle cmps by tagname', () => {
    const cmps: d.ComponentCompilerMeta[] = [
      { tagName: 'c', dependants: [], dependencies: [] },
      { tagName: 'b', dependants: [], dependencies: [] },
      { tagName: 'a', dependants: [], dependencies: [] }
    ];
    cmps.sort(sortBundleComponents);
    expect(cmps[0].tagName).toBe('a');
    expect(cmps[1].tagName).toBe('b');
    expect(cmps[2].tagName).toBe('c');
  });

});
