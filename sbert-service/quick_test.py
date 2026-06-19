"""
Quick test script to verify SBERT service endpoints.
"""
import sys

import requests


BASE_URL = "http://localhost:8000"
EMBEDDING_DIMENSION = 384


def test_health():
    """Test the health endpoint."""
    print("Testing /health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        print("[PASS] Health endpoint test passed!\n")
        return True
    except Exception as error:
        print(f"[FAIL] Health endpoint test failed: {error}\n")
        return False


def test_embed():
    """Test the embed endpoint."""
    print("Testing /embed endpoint...")
    try:
        response = requests.post(
            f"{BASE_URL}/embed",
            json={"text": "This is a test sentence for embedding generation."},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        print(f"Status Code: {response.status_code}")
        data = response.json()
        embedding = data.get("embedding", [])
        dimension = data.get("dimension")

        print(f"Embedding dimension: {dimension}")
        print(f"First 5 values: {embedding[:5]}")

        assert response.status_code == 200
        assert dimension == EMBEDDING_DIMENSION
        assert len(embedding) == EMBEDDING_DIMENSION
        assert all(isinstance(value, (int, float)) for value in embedding)
        print("[PASS] Embed endpoint test passed!\n")
        return True
    except Exception as error:
        print(f"[FAIL] Embed endpoint test failed: {error}\n")
        return False


def test_embed_empty():
    """Test embed endpoint with empty text."""
    print("Testing /embed endpoint with empty text...")
    try:
        response = requests.post(
            f"{BASE_URL}/embed",
            json={"text": ""},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")

        assert response.status_code in (400, 422)
        print("[PASS] Empty text validation test passed!\n")
        return True
    except Exception as error:
        print(f"[FAIL] Empty text validation test failed: {error}\n")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("SBERT Service Quick Test Suite")
    print("=" * 60 + "\n")

    results = [
        ("Health Endpoint", test_health()),
        ("Embed Endpoint", test_embed()),
        ("Empty Text Validation", test_embed_empty()),
    ]

    print("=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "PASSED" if result else "FAILED"
        print(f"{test_name}: {status}")

    print(f"\nTotal: {passed}/{total} tests passed")
    print("=" * 60)

    return passed == total


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
