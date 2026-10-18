import struct
import unittest
from extract_game import unpack_nispack, story_index, read_keywords


class ExtractionTests(unittest.TestCase):
    def archive(self, offset=60, name=b'story.dat'):
        return b'prefix' + b'NISPACK\0' + struct.pack('<II', 0, 1) + struct.pack('<32sIII', name, offset, 4, 0) + b'TEST'

    def test_archive_offsets_are_relative_to_embedded_header(self):
        data = self.archive()
        base, entries = unpack_nispack(data)
        self.assertEqual(base, 6)
        self.assertEqual(data[entries[0]['offset']:entries[0]['offset'] + 4], b'TEST')

    def test_archive_rejects_out_of_bounds_entry(self):
        with self.assertRaises(ValueError):
            unpack_nispack(self.archive(offset=1000))

    def test_archive_rejects_path_traversal(self):
        with self.assertRaises(ValueError):
            unpack_nispack(self.archive(name=b'../escape'))

    def test_story_index_sizes(self):
        data = struct.pack('<6I', 24, 2, 10, 24, 20, 28) + b'12345678'
        self.assertEqual(story_index(data), [{'id': 10, 'offset': 24, 'size': 4}, {'id': 20, 'offset': 28, 'size': 4}])

    def test_story_rejects_invalid_offset(self):
        with self.assertRaises(ValueError):
            story_index(struct.pack('<4I', 16, 1, 10, 99))

    def test_keywords_follow_pointer_and_length(self):
        text = '小暮'.encode('cp932')
        data = struct.pack('<IHHI', 1, 4600, len(text), 32) + bytes(20) + text
        self.assertEqual(read_keywords(data)[0]['text'], '小暮')

    def test_keywords_reject_invalid_pointer(self):
        with self.assertRaises(ValueError):
            read_keywords(struct.pack('<IHHI', 1, 4600, 4, 999) + bytes(20))


if __name__ == '__main__':
    unittest.main()
