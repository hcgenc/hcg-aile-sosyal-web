import { createSupabaseClient } from "@/lib/supabase-helpers"

// Track if the script is already loading
let isLoading = false
let isLoaded = false
let loadPromise: Promise<void> | null = null
let cachedApiKey: string | null = null

// Get Yandex Maps API key from Supabase
async function getYandexApiKey(): Promise<string> {
  // Return cached key if available
  if (cachedApiKey) {
    return cachedApiKey
  }

  try {
    const supabase = createSupabaseClient()

    const { data, error } = await supabase
      .from("api_keys")
      .select("api_key")
      .eq("service_name", "yandex_maps")
      .eq("is_active", true)
      .single()

    if (error) {
      console.error("Error fetching Yandex API key from Supabase:", error)
      throw new Error(`Supabase API key fetch failed: ${error.message}`)
    }

    if (!data?.api_key) {
      console.error("No active Yandex API key found in Supabase")
      throw new Error("No active Yandex Maps API key found in database. Please add an API key in the admin panel.")
    }

    cachedApiKey = data.api_key
    console.log("Successfully loaded Yandex API key from Supabase")
    return data.api_key
  } catch (error) {
    console.error("Error connecting to Supabase for API key:", error)
    throw new Error(`Failed to retrieve Yandex Maps API key: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Load Yandex Maps API script
export async function loadYandexMapsScript(): Promise<void> {
  // If already loaded, return resolved promise
  if (isLoaded && window.ymaps) {
    return Promise.resolve()
  }

  // If already loading, return the existing promise
  if (isLoading && loadPromise) {
    return loadPromise
  }

  // Start loading
  isLoading = true

  loadPromise = new Promise(async (resolve, reject) => {
    try {
      // Get API key from Supabase
      const apiKey = await getYandexApiKey()

      // Check if script already exists
      if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
        // Script exists, wait for ymaps to be ready
        if (window.ymaps) {
          isLoaded = true
          resolve()
        } else {
          // Wait for ymaps to be ready
          const checkYmaps = setInterval(() => {
            if (window.ymaps) {
              clearInterval(checkYmaps)
              isLoaded = true
              resolve()
            }
          }, 100)

          // Set timeout to avoid infinite waiting
          setTimeout(() => {
            clearInterval(checkYmaps)
            reject(new Error("Yandex Maps API failed to load within timeout"))
          }, 10000)
        }
        return
      }

      // Create script element with API key from Supabase
      const script = document.createElement("script")
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=tr_TR`
      script.async = true
      script.defer = true

      script.onload = () => {
        // Wait for ymaps to be ready
        window.ymaps.ready(() => {
          isLoaded = true
          console.log("Yandex Maps API loaded successfully with Supabase API key")
          resolve()
        })
      }

      script.onerror = (error) => {
        isLoading = false
        loadPromise = null
        reject(new Error("Failed to load Yandex Maps API"))
      }

      document.head.appendChild(script)
    } catch (error) {
      isLoading = false
      loadPromise = null
      reject(new Error(`Failed to get API key: ${error}`))
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
      // Use more specific search options for Turkey
      const searchOptions = {
        results: 5,
        boundedBy: [
          [35.815617, 25.668501], // Southwest corner of Turkey
          [42.109153, 44.834229], // Northeast corner of Turkey
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

            console.log("Found coordinates:", coords)
            console.log("Address line:", addressLine)

            resolve([coords[0], coords[1]])
          } else {
            console.log("No geocoding results found")
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

    console.log("Enhanced geocoding queries:", searchQueries)

    // Try each query until we get a result
    for (const query of searchQueries) {
      try {
        const result = await new Promise<{ coords: [number, number]; details: any } | null>((resolve, reject) => {
          const searchOptions = {
            results: 3,
            boundedBy: [
              [35.815617, 25.668501], // Southwest corner of Turkey
              [42.109153, 44.834229], // Northeast corner of Turkey
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

                console.log(`Found result for query "${query}":`, { coords, details })

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

    console.log("No results found for any query")
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
    const supabase = createSupabaseClient()

    const { error } = await supabase
      .from("api_keys")
      .update({
        api_key: newApiKey,
        updated_at: new Date().toISOString(),
      })
      .eq("service_name", "yandex_maps")

    if (error) {
      console.error("Error updating Yandex API key:", error)
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

// Add TypeScript declarations for Yandex Maps
declare global {
  interface Window {
    ymaps: any
  }
}
