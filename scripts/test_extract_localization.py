import unittest
from extract_localization import extract


class LocalizationInventoryTests(unittest.TestCase):
    def test_confirmation_and_all_overlay_labels_use_runtime_keys(self):
        game = {'scripts': {'20001': {'offset': 0, 'instructions': [
            {'op': 1310, 'offset': 12, 'label': '確定？'},
            {'op': 1401, 'offset': 32, 'label': '検証１'},
        ]}}, 'chapters': []}
        entries = {e['key']: e for e in extract(game)}
        self.assertEqual(entries['prompt.20001.1']['source'], '確定？')
        self.assertEqual(entries['prompt.20001.1']['offset'], 12)
        self.assertEqual(entries['label.検証１']['kind'], 'display-label')
        self.assertIn('script.20001.12.label', entries)


if __name__ == '__main__':
    unittest.main()
