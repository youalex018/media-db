#!/usr/bin/env python3
"""
Automated Authentication Test Script

This script tests the authentication endpoints without requiring manual token generation.
It validates the error handling and response formats.

Usage:
    python test_auth.py [--verbose]
"""

import argparse
import requests
import sys
import json
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost:5000"
TIMEOUT = 10

def test_health_endpoint() -> Dict[str, Any]:
    """Test the health endpoint (unauthenticated)."""
    print("[TEST] Testing health endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/healthz", timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'ok':
                print("[PASS] Health endpoint: PASS")
                return {"status": "pass", "message": "Health endpoint working"}
            else:
                print(f"[FAIL] Health endpoint: Unexpected response: {data}")
                return {"status": "fail", "message": f"Unexpected response: {data}"}
        else:
            print(f"[FAIL] Health endpoint: Status {response.status_code}")
            return {"status": "fail", "message": f"Status {response.status_code}"}
            
    except requests.exceptions.ConnectionError:
        print("[FAIL] Health endpoint: Connection failed - is the backend running?")
        return {"status": "fail", "message": "Connection failed"}
    except Exception as e:
        print(f"[FAIL] Health endpoint: Error: {e}")
        return {"status": "fail", "message": str(e)}

def test_auth_endpoint_errors() -> Dict[str, Any]:
    """Test authentication endpoint error handling."""
    print("[TEST] Testing authentication error handling...")
    
    # First check if backend is connected to Supabase
    try:
        response = requests.get(f"{BASE_URL}/healthz", timeout=TIMEOUT)
        backend_running = response.status_code == 200
    except:
        backend_running = False
    
    if not backend_running:
        print("[FAIL] Backend not running - cannot test authentication")
        return {"status": "fail", "message": "Backend not accessible"}
    
    test_cases = [
        {
            "name": "No Authorization header",
            "headers": {},
            "expected_error": "missing_authorization_header"
        },
        {
            "name": "Invalid Bearer format",
            "headers": {"Authorization": "Token invalid"},
            "expected_error": "invalid_bearer_format"
        },
        {
            "name": "Empty Bearer token",
            "headers": {"Authorization": "Bearer "},
            "expected_error": "empty_token"
        },
        {
            "name": "Malformed token",
            "headers": {"Authorization": "Bearer not-a-jwt"},
            "expected_error": "invalid_jwt_format"
        },
        {
            "name": "Valid format token with missing kid",
            "headers": {"Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.fake-signature"},
            "expected_error": "missing_key_id"  # RS256 token with no kid in header
        },
        {
            "name": "Token with fake kid",
            "headers": {"Authorization": "Bearer eyJhbGciOiAiUlMyNTYiLCAidHlwIjogIkpXVCIsICJraWQiOiAiZmFrZS1rZXktaWQifQ.eyJzdWIiOiAiMTIzNDU2Nzg5MCIsICJuYW1lIjogIkpvaG4gRG9lIiwgImlhdCI6IDE1MTYyMzkwMjJ9.fake-signature"},
            "expected_error": "key_not_found"  # This token has a fake kid that won't be in the auth key set
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        try:
            response = requests.get(
                f"{BASE_URL}/api/me",
                headers=test_case["headers"],
                timeout=TIMEOUT
            )
            
            if response.status_code == 401:
                try:
                    data = response.json()
                    error_code = data.get('error')
                    
                    if error_code == test_case["expected_error"]:
                        print(f"[PASS] {test_case['name']}: PASS ({error_code})")
                        results.append({"test": test_case["name"], "status": "pass"})
                    elif (error_code == "jwks_unavailable" and 
                          test_case["expected_error"] in ["key_not_found", "missing_key_id"]):
                        # When the auth key set is unavailable, we can't test key-related errors
                        print(f"[SKIP] {test_case['name']}: SKIP (auth key set unavailable - expected {test_case['expected_error']}, got {error_code})")
                        results.append({"test": test_case["name"], "status": "skip", "reason": "auth key set unavailable"})
                    else:
                        print(f"[FAIL] {test_case['name']}: Expected {test_case['expected_error']}, got {error_code}")
                        results.append({"test": test_case["name"], "status": "fail", "expected": test_case["expected_error"], "actual": error_code})
                        
                except json.JSONDecodeError:
                    print(f"[FAIL] {test_case['name']}: Response not JSON")
                    results.append({"test": test_case["name"], "status": "fail", "message": "Response not JSON"})
            else:
                print(f"[FAIL] {test_case['name']}: Expected 401, got {response.status_code}")
                results.append({"test": test_case["name"], "status": "fail", "message": f"Expected 401, got {response.status_code}"})
                
        except Exception as e:
            print(f"[FAIL] {test_case['name']}: Error: {e}")
            results.append({"test": test_case["name"], "status": "fail", "message": str(e)})
    
    passed = sum(1 for r in results if r["status"] == "pass")
    skipped = sum(1 for r in results if r["status"] == "skip")
    failed = sum(1 for r in results if r["status"] == "fail")
    total = len(results)
    
    print(f"\n[SUMMARY] Authentication error tests: {passed} passed, {skipped} skipped, {failed} failed ({total} total)")
    
    if failed == 0:
        return {"status": "pass", "results": results}
    elif passed > 0:
        return {"status": "partial", "results": results}
    else:
        return {"status": "fail", "results": results}

def test_cors_headers() -> Dict[str, Any]:
    """Test CORS configuration."""
    print("[TEST] Testing CORS headers...")
    
    try:
        # Test preflight request
        response = requests.options(
            f"{BASE_URL}/api/me",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization"
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            cors_headers = {
                "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
                "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
                "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers")
            }
            
            print("[PASS] CORS preflight: PASS")
            return {"status": "pass", "headers": cors_headers}
        else:
            print(f"[FAIL] CORS preflight: Status {response.status_code}")
            return {"status": "fail", "message": f"Status {response.status_code}"}
            
    except Exception as e:
        print(f"[FAIL] CORS test: Error: {e}")
        return {"status": "fail", "message": str(e)}

def main():
    """Run all authentication tests."""
    parser = argparse.ArgumentParser(description="Test authentication endpoints")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()
    
    print("Authentication Test Suite")
    print("=" * 50)
    
    # Run all tests
    test_results = {
        "health": test_health_endpoint(),
        "auth_errors": test_auth_endpoint_errors(),
        "cors": test_cors_headers()
    }
    
    print("\n" + "=" * 50)
    print("Test Summary")
    
    overall_status = "pass"
    for test_name, result in test_results.items():
        status = result["status"]
        if status == "fail":
            overall_status = "fail"
        elif status == "partial" and overall_status == "pass":
            overall_status = "partial"
            
        print(f"{test_name}: {status.upper()}")
    
    if args.verbose:
        print("\nDetailed Results:")
        print(json.dumps(test_results, indent=2))
    
    # Exit with appropriate code
    if overall_status == "pass":
        print("\n[SUCCESS] All tests passed!")
        sys.exit(0)
    elif overall_status == "partial":
        print("\n[PARTIAL] Some tests failed")
        sys.exit(1)
    else:
        print("\n[FAIL] Critical tests failed - check backend connectivity")
        sys.exit(2)

if __name__ == "__main__":
    main()
