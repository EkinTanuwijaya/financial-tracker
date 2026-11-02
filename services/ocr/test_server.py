import unittest
from server import extract_result


class ExtractResultTests(unittest.TestCase):
    def test_preserves_reading_order_amounts_and_repeated_items(self):
        result = extract_result([{
            "rec_texts": [" OCTO Mobile ", "Rp 1.600.000,50", "28/03/2025", "Kopi 25.000", "Kopi 25.000"],
            "rec_scores": [0.9, 1.0, 0.9, 1.0, 1.0],
        }])
        self.assertEqual(result["text"], "OCTO Mobile\nRp 1.600.000,50\n28/03/2025\nKopi 25.000\nKopi 25.000")
        self.assertEqual(result["confidence"], 96)

    def test_blank_detections_do_not_affect_confidence(self):
        result = extract_result([{"rec_texts": [" ", "Total"], "rec_scores": [0.1, 0.9]}])
        self.assertEqual(result, {"text": "Total", "confidence": 90})

    def test_no_text(self):
        self.assertEqual(extract_result([]), {"text": "", "confidence": 0})


if __name__ == "__main__":
    unittest.main()
