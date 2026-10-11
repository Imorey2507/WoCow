/**
 * WoCow · LocationPicker
 * Owner: Person 2 (Map)
 *
 * A tap-to-drop-pin map used inside the "Host an activity" form. It reports
 * coordinates upward, and also suggests the nearest named campus location so
 * the user does not have to type a place name.
 *
 * `onPick` is called with raw coordinates; `onSuggestion` with a named spot
 * when the pin landed close to one.
 */
import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { CAMPUS_CENTER, nearestCampusLocation, type CampusLocation } from './campusLocations'

export interface LocationPickerProps {
  value: { latitude: number; longitude: number } | null
  onChange: (coords: { latitude: number; longitude: number }) => void
  /** Fired when the pin lands near a known campus spot. */
  onSuggestion?: (location: CampusLocation) => void
  height?: number
}

const pickIcon = L.divIcon({
  className: 'wocow-marker',
  html: '<span class="wocow-pin wocow-pin--pick">📍</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
})

/** Turns map clicks into onChange calls. Must be a child of MapContainer. */
function ClickCatcher({
  onPick,
}: {
  onPick: (latitude: number, longitude: number) => void
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

/** Keeps the camera on the pin when the value is set from outside. */
function FollowPin({ value }: { value: LocationPickerProps['value'] }) {
  const map = useMap()

  useEffect(() => {
    if (value) map.panTo([value.latitude, value.longitude], { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.latitude, value?.longitude, map])

  return null
}

export function LocationPicker({
  value,
  onChange,
  onSuggestion,
  height = 260,
}: LocationPickerProps) {
  const center: [number, number] = value
    ? [value.latitude, value.longitude]
    : [CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude]

  const handlePick = (latitude: number, longitude: number) => {
    onChange({ latitude, longitude })
    if (onSuggestion) {
      const nearest = nearestCampusLocation(latitude, longitude)
      if (nearest) onSuggestion(nearest)
    }
  }

  return (
    <div className="wocow-location-picker" style={{ height }}>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <ClickCatcher onPick={handlePick} />
        <FollowPin value={value} />

        {value && (
          <Marker position={[value.latitude, value.longitude]} icon={pickIcon} />
        )}
      </MapContainer>

      <p className="wocow-location-picker__hint">Tap the map to drop a pin.</p>
    </div>
  )
}

export default LocationPicker
