import json,struct,unittest
from pathlib import Path
from compile_animations import compile_animations,package_index
from compile_assets import Assets
from compile_prologue import ROOT

class AnimationCompilerTests(unittest.TestCase):
    def test_package_lookup_matches_original_dispatch_ranges(self):
        self.assertEqual([package_index(n) for n in [100,200,600,700,1000,1700,5400]],[2,3,7,8,9,12,13])
        with self.assertRaises(ValueError):package_index(42)

    def test_actual_animation_tables_and_atlases(self):
        data=compile_animations(Assets(),[dict(op=2403,args=[200,2,0]),dict(op=2403,args=[700,10,0])])
        rain=data['200'];self.assertEqual(len(rain['variants']),13)
        self.assertEqual(rain['variants']['2'],dict(start=7,end=20))
        self.assertEqual(rain['cells'][7]['width'],480)
        self.assertEqual(rain['cells'][7]['height'],272)
        for animation in data.values():
            for texture in animation['textures'].values():
                png=(ROOT/'public/game'/texture['file']).read_bytes()
                self.assertEqual(struct.unpack_from('>II',png,16),(texture['width'],texture['height']))
        fallback=compile_animations(Assets(),[dict(op=2403,args=[200,99,0])])["200"]
        self.assertEqual(fallback["variants"]["99"],fallback["variants"]["0"])
        self.assertEqual(fallback["variantFallbacks"]["99"],0)

    def test_remaining_source_variant_fallback_and_terminal_cell(self):
        data=compile_animations(Assets(),[dict(op=2403,args=[1,2152,0]),dict(op=2403,args=[6200,0,0])])
        self.assertEqual(data['1']['variants']['2152'],data['1']['variants']['0'])
        self.assertEqual(data['1']['variantFallbacks']['2152'],0)
        self.assertIsNone(data['6200']['cells'][8])
        self.assertTrue(any(cell is not None for cell in data['6200']['cells']))
