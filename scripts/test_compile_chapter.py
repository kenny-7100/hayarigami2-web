import struct, unittest, zlib
from compile_assets import texture_png
from compile_chapter import compile_data, Decoder, JapaneseDecoder


def pixels(png):
    pos=8; raw=b''
    while pos<len(png):
        size=struct.unpack_from('>I',png,pos)[0]
        if png[pos+4:pos+8]==b'IDAT':raw+=png[pos+8:pos+8+size]
        pos+=12+size
    return zlib.decompress(raw)

class ChapterTests(unittest.TestCase):
    def test_complete_script_and_relationship_conversion(self):
        data=compile_data()
        self.assertEqual(len(data['scripts']),371)
        self.assertEqual(len(data['logic']['fields']),16)
        for field in data['logic']['fields']:
            self.assertTrue(any(c['id']==0 for c in field['choices']))
            for choice in field['choices']:
                if choice['id']:self.assertIn(str(choice['id']),data['keywords'])
        self.assertTrue(all(data['definitions'][key] for key in data['terms']))

    def test_name_templates_and_fragment_spacing(self):
        decoder=Decoder()
        self.assertEqual(decoder.text(bytes.fromhex("876c876d")),"{surname}{givenName}")
        decoder.mapping["20"]=" "
        self.assertEqual(decoder.text(b" ",trim=False)," ")
        self.assertEqual(decoder.text(b" "),"")

    def test_untranslated_chapter_is_unicode_japanese(self):
        decoder=JapaneseDecoder()
        text='小暮さんがふと呟いた一言を、'
        self.assertEqual(decoder.text(text.encode('cp932')),text)
        self.assertEqual(decoder.text(bytes.fromhex('8789')),'鬼')
        self.assertEqual(decoder.text(bytes.fromhex('876c876d876e'),trim=False),'{surname}{givenName} ')
        with self.assertRaises((ValueError,UnicodeDecodeError)):decoder.text(b'\x81')
        data=compile_data(1)
        self.assertEqual(len(data['scripts']),457)
        self.assertEqual(data['logic']['id'],3)
        self.assertEqual(len(data['logic']['fields']),20)
        self.assertEqual(data['scripts']['20201']['language'],'ja')
        self.assertEqual(data['scripts']['20101']['language'],'zh-CN')
        self.assertEqual(data['keywords']['4721'],'孪生')
        for field in data['logic']['fields']:
            for choice in field['choices']:
                if choice['id']:self.assertIn(str(choice['id']),data['keywords'])
        self.assertTrue(all(data['definitions'][key] for key in data['terms']))

    def test_missing_glyph_is_reported(self):
        decoder=Decoder();decoder.mapping={}
        decoder.text(bytes.fromhex('889f'))
        self.assertEqual(decoder.missing,{'889f'})

    def test_dxt3_and_dxt5_alpha(self):
        for kind,alpha in [(1,b'\x88'*8),(2,b'\0'*6+bytes([136,0]))]:
            header=bytearray(16);struct.pack_into('<HH',header,0,4,4);struct.pack_into('<H',header,6,kind)
            png=texture_png(header+struct.pack('<IHH',0,0xf800,0)+alpha)
            self.assertEqual(pixels(png),(b'\0'+bytes([255,0,0,136])*4)*4)
            with self.assertRaises(ValueError):texture_png(header+b'\0')

    def test_indexed_textures_crop_padded_rows(self):
        for kind in [16,256]:
            header=bytearray(16);struct.pack_into('<HH',header,0,2,1);struct.pack_into('<HHH',header,6,kind,2,1);struct.pack_into('<H',header,14,4)
            palette=bytes([255,0,0,255,0,255,0,128])
            body=bytes([0x10,0]) if kind==16 else bytes([0,1,0,0])
            self.assertEqual(pixels(texture_png(header+palette+body)),b'\0'+palette)

if __name__=='__main__':unittest.main()
