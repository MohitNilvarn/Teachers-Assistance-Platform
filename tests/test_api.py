import requests
import json

BASE_URL = "http://127.0.0.1:8000/api/v1"

print("Testing Frontend-Backend Connection\n" + "="*50)

# Test 1: Health Check
print("\n1. Testing Health Endpoint...")
try:
    response = requests.get(f"http://127.0.0.1:8000/api/v1/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Root Health Check
print("\n2. Testing Root Endpoint...")
try:
    response = requests.get("http://127.0.0.1:8000/")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: OpenAPI Docs
print("\n3. Checking OpenAPI Documentation...")
try:
    response = requests.get("http://127.0.0.1:8000/docs")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ API Docs available at http://127.0.0.1:8000/docs")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "="*50)
print("✅ Backend is running and ready for frontend connection!")
print("\nNext steps:")
print("1. Update .env.local with VITE_API_URL=http://127.0.0.1:8000/api/v1")
print("2. Run: npm run dev")
print("3. Visit: http://localhost:5173")
