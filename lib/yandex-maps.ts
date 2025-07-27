// Track if the script is already loading
let isLoading = false
let isLoaded = false
let loadPromise: Promise<void> | null = null
let cachedApiKey: string | null = null

// Get Yandex Maps API key from Supabase via proxy
async function getYandexApiKey(): Promise<string> {
  // Return cached key if available
  if (cachedApiKey) {
    console.log("Using cached Yandex API key")
    return cachedApiKey
  }

  try {
    console.log("Fetching Yandex API key from Supabase via proxy...")
    
    // Make API call without authentication since api_keys is in public read tables
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        table: 'api_keys',
        method: 'SELECT',
        select: 'api_key',
        filter: {
          service_name: 'Yandex Maps',
          is_active: true
        },
        single: true
      })
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const result = await response.json()
    console.log("Supabase proxy result:", result)

    if (result.error) {
      console.error("Error fetching Yandex API key from Supabase:", result.error)
      throw new Error(`Supabase API key fetch failed: ${result.error}`)
    }

    if (!result.data?.api_key) {
      console.error("No active Yandex API key found in Supabase")
      console.log("Result data:", result.data)
      throw new Error("No active Yandex Maps API key found in database. Please add an API key in the admin panel.")
    }

    cachedApiKey = result.data.api_key
    console.log("Successfully loaded Yandex API key from Supabase via proxy:", cachedApiKey ? cachedApiKey.substring(0, 8) + "..." : "null")
    return result.data.api_key
  } catch (error) {
    console.error("Error connecting to Supabase for API key:", error)
    throw new Error(`Failed to retrieve Yandex Maps API key: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Load Yandex Maps API script
export async function loadYandexMapsScript(): Promise<void> {
  if (isLoaded) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise(async (resolve, reject) => {
    try {
      isLoading = true

      // Get API key from Supabase
      const apiKey = await getYandexApiKey()

      if (!apiKey) {
        console.warn("No Yandex Maps API key found, using free version")
        // Try to load without API key for development
      }

      // Check if already loaded
        if (window.ymaps) {
          isLoaded = true
          resolve()
        return
      }

      // Create script element
      const script = document.createElement("script")
      script.type = "text/javascript"
      script.src = apiKey 
        ? `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=tr_TR`
        : `https://api-maps.yandex.ru/2.1/?lang=tr_TR`

      // Handle successful load
      script.onload = () => {
        console.log("Yandex Maps script loaded, waiting for ymaps.ready()")
        
        // Wait for ymaps to be ready with timeout
        const timeout = setTimeout(() => {
          console.error("Yandex Maps ymaps.ready() timeout")
          isLoading = false
          loadPromise = null
          reject(new Error("Yandex Maps initialization timeout"))
        }, 10000) // 10 second timeout

        try {
        window.ymaps.ready(() => {
            clearTimeout(timeout)
          isLoaded = true
            isLoading = false
            console.log("Yandex Maps API loaded successfully")
          resolve()
        })
        } catch (error) {
          clearTimeout(timeout)
          isLoading = false
          loadPromise = null
          console.error("Error in ymaps.ready():", error)
          reject(new Error(`Yandex Maps ready error: ${error}`))
        }
      }

      // Handle loading errors
      script.onerror = (error) => {
        isLoading = false
        loadPromise = null
        console.error("Failed to load Yandex Maps script:", error)
        console.log("Script src was:", script.src)
        reject(new Error("Failed to load Yandex Maps script - Network error"))
      }

      // Add script to document
      document.head.appendChild(script)
      console.log("Yandex Maps script added to document head")

    } catch (error) {
      isLoading = false
      loadPromise = null
      console.error("Error in loadYandexMapsScript:", error)
      reject(new Error(`Failed to initialize Yandex Maps: ${error}`))
    }
  })

  return loadPromise
}

// Geocode an address to get coordinates with improved search
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    await loadYandexMapsScript()

    if (!window.ymaps) {
      throw new Error("Yandex Maps API not loaded")
    }

    console.log("Geocoding address:", address)

    return new Promise((resolve, reject) => {
      // Use more specific search options for Aksaray region
      const searchOptions = {
        results: 5,
        boundedBy: [
          [37.8, 33.5], // Southwest corner of Aksaray region
          [38.9, 34.6], // Northeast corner of Aksaray region
        ],
        strictBounds: false,
      }

      window.ymaps
        .geocode(address, searchOptions)
        .then((res: any) => {
          console.log("Geocoding response:", res)

          const firstGeoObject = res.geoObjects.get(0)

          if (firstGeoObject) {
            const coords = firstGeoObject.geometry.getCoordinates()
            const addressLine = firstGeoObject.getAddressLine()

            resolve([coords[0], coords[1]])
          } else {
            resolve(null)
          }
        })
        .catch((error: any) => {
          console.error("Geocoding error:", error)
          reject(error)
        })
    })
  } catch (error) {
    console.error("Error loading Yandex Maps:", error)
    return null
  }
}

// Enhanced geocoding with multiple search strategies
export async function geocodeAddressEnhanced(
  province: string,
  district: string,
  neighborhood: string,
  address: string,
): Promise<{ coords: [number, number]; details: any } | null> {
  try {
    await loadYandexMapsScript()

    if (!window.ymaps) {
      throw new Error("Yandex Maps API not loaded")
    }

    // Create multiple search queries with different levels of detail
    const searchQueries = []

    // Most specific query
    if (address && neighborhood && district && province) {
      searchQueries.push(`${address}, ${neighborhood}, ${district}, ${province}, Türkiye`)
    }

    // Without specific address
    if (neighborhood && district && province) {
      searchQueries.push(`${neighborhood}, ${district}, ${province}, Türkiye`)
    }

    // District level
    if (district && province) {
      searchQueries.push(`${district}, ${province}, Türkiye`)
    }

    // Province level
    if (province) {
      searchQueries.push(`${province}, Türkiye`)
    }

    // Try each query until we get a result
    for (const query of searchQueries) {
      try {
        const result = await new Promise<{ coords: [number, number]; details: any } | null>((resolve, reject) => {
          const searchOptions = {
            results: 3,
            boundedBy: [
              [37.8, 33.5], // Southwest corner of Aksaray region
              [38.9, 34.6], // Northeast corner of Aksaray region
            ],
            strictBounds: false,
          }

          window.ymaps
            .geocode(query, searchOptions)
            .then((res: any) => {
              const firstGeoObject = res.geoObjects.get(0)

              if (firstGeoObject) {
                const coords = firstGeoObject.geometry.getCoordinates()
                const addressLine = firstGeoObject.getAddressLine()

                // Extract address components
                const details = {
                  fullAddress: addressLine,
                  country: firstGeoObject.getCountry() || "",
                  province: firstGeoObject.getAdministrativeAreas()?.[0] || "",
                  district: firstGeoObject.getLocalities()?.[0] || "",
                  neighborhood: firstGeoObject.getThoroughfare() || "",
                  street: firstGeoObject.getThoroughfare() || "",
                  houseNumber: firstGeoObject.getPremiseNumber() || "",
                }

                resolve({
                  coords: [coords[0], coords[1]],
                  details,
                })
              } else {
                resolve(null)
              }
            })
            .catch((error: any) => {
              console.error(`Geocoding error for query "${query}":`, error)
              reject(error)
            })
        })

        if (result) {
          return result
        }
      } catch (error) {
        console.error(`Failed to geocode query "${query}":`, error)
        continue
      }
    }

    return null
  } catch (error) {
    console.error("Error in enhanced geocoding:", error)
    return null
  }
}

// Get address details from coordinates
export async function reverseGeocode(coords: [number, number]): Promise<any | null> {
  try {
    await loadYandexMapsScript()

    if (!window.ymaps) {
      throw new Error("Yandex Maps API not loaded")
    }

    return new Promise((resolve, reject) => {
      window.ymaps
        .geocode(coords)
        .then((res: any) => {
          const firstGeoObject = res.geoObjects.get(0)

          if (firstGeoObject) {
            const addressLine = firstGeoObject.getAddressLine()
            const addressDetails = {
              fullAddress: addressLine,
              country: firstGeoObject.getCountry() || "",
              province: firstGeoObject.getAdministrativeAreas()?.[0] || "",
              district: firstGeoObject.getLocalities()?.[0] || "",
              neighborhood: firstGeoObject.getThoroughfare() || "",
              street: firstGeoObject.getThoroughfare() || "",
              houseNumber: firstGeoObject.getPremiseNumber() || "",
              address: firstGeoObject.getPremiseNumber()
                ? `${firstGeoObject.getThoroughfare()} No:${firstGeoObject.getPremiseNumber()}`
                : firstGeoObject.getThoroughfare() || "",
            }
            resolve(addressDetails)
          } else {
            resolve(null)
          }
        })
        .catch((error: any) => {
          console.error("Reverse geocoding error:", error)
          reject(error)
        })
    })
  } catch (error) {
    console.error("Error loading Yandex Maps:", error)
    return null
  }
}

// Function to update API key in Supabase (for admin use)
export async function updateYandexApiKey(newApiKey: string): Promise<boolean> {
  try {
    // Get authentication token from localStorage
    const token = localStorage.getItem("auth_token")
    if (!token) {
      console.error("No authentication token found, cannot update API key")
      return false
    }

    // Make authenticated API call
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        table: 'api_keys',
        method: 'UPDATE',
        data: {
          api_key: newApiKey,
          updated_at: new Date().toISOString(),
        },
        filter: {
          service_name: 'yandex_maps'
        }
      })
    })

    if (!response.ok) {
      console.error("Error updating Yandex API key: API request failed")
      return false
    }

    const result = await response.json()

    if (result.error) {
      console.error("Error updating Yandex API key:", result.error)
      return false
    }

    // Clear cached key to force reload
    cachedApiKey = null
    console.log("Yandex API key updated successfully")
    return true
  } catch (error) {
    console.error("Error updating API key:", error)
    return false
  }
}

// Test function to debug API key fetching
export async function testYandexApiKeyFetch(): Promise<void> {
  try {
    console.log("=== TESTING YANDEX API KEY FETCH ===")
    
    // Check if authentication token exists
    const token = localStorage.getItem("auth_token")
    if (!token) {
      console.warn("No authentication token found for testing")
      return
    }
    
    // Direct API call to test proxy with authentication
    const directResponse = await fetch('/api/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        table: 'api_keys',
        method: 'SELECT',
        select: 'api_key',
        filter: {
          service_name: 'Yandex Maps',
          is_active: true
        },
        single: true
      })
    })
    const directData = await directResponse.json()
    console.log("Direct API response:", directData)
    
    // Test API key retrieval
    const apiKey = await getYandexApiKey()
    console.log("Retrieved API key:", apiKey ? apiKey.substring(0, 8) + "..." : "null")
    
  } catch (error) {
    console.error("Test failed:", error)
  }
}

// Add TypeScript declarations for Yandex Maps
declare global {
  interface Window {
    ymaps: any
  }
}
