import React from 'react'
import { Flame, Shield, Activity, Lock } from 'lucide-react'

export function CourseIcon({ courseName }) {
  const cn = (courseName || '').toLowerCase()
  if (cn.includes('fire') || cn.includes('marshal')) {
    return <Flame size={14} className="prov-course-icon" />
  }
  if (cn.includes('security') || cn.includes('asset') || cn.includes('height')) {
    return <Shield size={14} className="prov-course-icon" />
  }
  if (cn.includes('first aid') || cn.includes('cpr') || cn.includes('responder')) {
    return <Activity size={14} className="prov-course-icon" />
  }
  return <Lock size={14} className="prov-course-icon" />
}
