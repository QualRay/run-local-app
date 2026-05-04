'use client'
import { useEffect } from 'react'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

export function useWebVitals() {
  useEffect(() => {
    const report = (metric: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Web Vital]', metric.name, Math.round(metric.value), metric.rating)
      }
    }
    onCLS(report); onFCP(report); onINP(report);
    onLCP(report); onTTFB(report);
  }, [])
}
