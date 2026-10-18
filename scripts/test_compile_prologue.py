import struct
import unittest
import zlib
from compile_prologue import decode_text, parse_record, dxt1_png

class CompilationTests(unittest.TestCase):
    def test_unicode_requires_verified_glyph(self):
        self.assertEqual(decode_text(bytes.fromhex('889f'), {'889f':'你'}),'你')
        with self.assertRaises(ValueError): decode_text(b'X', {})

    def test_exact_length_padding_and_xor(self):
        raw = b'\xff\x05\x01\x00\x00\x00' + bytes(v^255 for v in bytes.fromhex('889f')) + b'\xff\x04\x02\x00'
        row=parse_record(raw,{'id':1,'offset':0,'size':len(raw)},{'889f':'你'})
        self.assertEqual([t['offset'] for t in row['instructions']],[0,6,8])
        self.assertEqual(row['instructions'][1]['text'],'你')

    def test_invalid_instruction_and_truncated_text(self):
        for raw in (b'\xff\x08\x01\x00',b'\xff\x04\xff\xff',b'\x77'):
            with self.assertRaises(ValueError):parse_record(raw,{'id':1,'offset':0,'size':len(raw)},{})

    def test_psp_dxt1_indices_precede_endpoints(self):
        raw=struct.pack('<HH',4,4)+bytes(12)+struct.pack('<IHH',0,0xf800,0)
        png=dxt1_png(raw)
        self.assertEqual(png[:8],b'\x89PNG\r\n\x1a\n')
        length=struct.unpack_from('>I',png,33)[0]
        scan=zlib.decompress(png[41:41+length])
        self.assertEqual(scan,(b'\0'+b'\xff\0\0'*4)*4)
        with self.assertRaises(ValueError):dxt1_png(raw[:-1])

if __name__=='__main__':unittest.main()
