import struct
import unittest
from audit_chapter import scan, make_report


class AuditTests(unittest.TestCase):
    def test_uint32_jump_and_new_opcode_sites(self):
        raw = b'\xff\x08\x65\x00' + struct.pack('<I', 70001)
        row = scan(raw, dict(id=30001, offset=0, size=len(raw)))
        report = make_report(raw, [row], {'101': '0x1'}, {2}, None)
        self.assertEqual(report['externalJumps'][0]['target'], 70001)
        self.assertEqual(report['newComparedToBaseline'], [101])
        self.assertEqual(report['opcodeSites']['101'], [dict(script=30001, pc=0, offset=0)])
        self.assertIsNone(report['missingGlyphs'])

    def test_absent_baseline_is_unknown_not_empty_support(self):
        raw = b'\xff\x04\x02\x00'
        report = make_report(raw, [scan(raw, dict(id=1, offset=0, size=4))])
        self.assertIsNone(report['newComparedToBaseline'])
        self.assertIsNone(report['unregisteredOpcodes'])

    def test_invalid_length_fails_at_source_boundary(self):
        with self.assertRaisesRegex(ValueError, 'Invalid instruction length'):
            scan(b'\xff\x08\x65\x00', dict(id=1, offset=0, size=4))

    def test_new_resources_include_variants_and_respect_pinned_silence(self):
        raw = b'\xff\x08\x63\x09' + struct.pack('<HH', 300, 2) + b'\xff\x06\x92\x03' + struct.pack('<H', 70)
        row = scan(raw, dict(id=30001, offset=0, size=len(raw)))
        report = make_report(raw, [row], baseline_data={'silentEffects': [70]})
        self.assertEqual(report['resourceReferences']['animationVariants'], ['300:2'])
        self.assertEqual(report['newResourceReferences']['animationVariants'], ['300:2'])
        self.assertEqual(report['newResourceReferences']['effects'], [])
