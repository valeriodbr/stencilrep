import * as d from '../../../declarations';
import { sortBundleComponents } from '../generate-lazy-module';


describe('sortBundleComponents', () => {

  it('sort bundle cmps by dependencies/dependants', () => {
    const cmps: d.ComponentCompilerMeta[] = [
      { tagName: 'c', dependencies: ['a', 'b'], dependants: [] },
      { tagName: 'b', dependencies: ['a'], dependants: ['c'] },
      { tagName: 'a', dependencies: [], dependants: ['b', 'c'] }
    ];
    cmps.sort(sortBundleComponents);
    expect(cmps[0].tagName).toBe('a');
    expect(cmps[1].tagName).toBe('b');
    expect(cmps[2].tagName).toBe('c');
  });

  it('sort bundle cmps by dependencies', () => {
    const cmps: d.ComponentCompilerMeta[] = [
      { tagName: 'c', dependencies: ['a', 'b'], dependants: [] },
      { tagName: 'b', dependencies: ['a'], dependants: [] },
      { tagName: 'a', dependencies: [], dependants: [] }
    ];
    cmps.sort(sortBundleComponents);
    expect(cmps[0].tagName).toBe('a');
    expect(cmps[1].tagName).toBe('b');
    expect(cmps[2].tagName).toBe('c');
  });

  it('sort bundle cmps by dependants', () => {
    const cmps: d.ComponentCompilerMeta[] = [
      { tagName: 'c', dependencies: [], dependants: [] },
      { tagName: 'b', dependencies: [], dependants: ['c'] },
      { tagName: 'a', dependencies: [], dependants: ['b', 'c'] }
    ];
    cmps.sort(sortBundleComponents);
    expect(cmps[0].tagName).toBe('a');
    expect(cmps[1].tagName).toBe('b');
    expect(cmps[2].tagName).toBe('c');
  });

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
