'use client'

import { useState, useEffect } from 'react'

// Базовый профиль (статичные поля)
interface ProfileData {
  name: string
  occupation: string
  industry: string
  maritalStatus: string
  hobbies: string
  sports: string
  location: string
  age: string
  education: string
  teamSize: string
  workExperience: string
  values: string
  challenges: string
  other: string
}

export default function ProfilePage() {
  // Базовый профиль
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    occupation: '',
    industry: '',
    maritalStatus: '',
    hobbies: '',
    sports: '',
    location: '',
    age: '',
    education: '',
    teamSize: '',
    workExperience: '',
    values: '',
    challenges: '',
    other: '',
  })
  const [saving, setSaving] = useState(false)

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) {
        console.error('Failed to load profile:', res.status)
        return
      }
      const data = await res.json()
      if (data) {
        setProfile({
          name: data.name || '',
          occupation: data.occupation || '',
          industry: data.industry || '',
          maritalStatus: data.maritalStatus || '',
          hobbies: data.hobbies || '',
          sports: data.sports || '',
          location: data.location || '',
          age: data.age?.toString() || '',
          education: data.education || '',
          teamSize: data.teamSize?.toString() || '',
          workExperience: data.workExperience || '',
          values: data.values || '',
          challenges: data.challenges || '',
          other: data.other || '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const saveProfile = async () => {
    setSaving(true)
    setMessage('')

    try {
      const payload = {
        ...profile,
        age: profile.age ? parseInt(profile.age) : null,
        teamSize: profile.teamSize ? parseInt(profile.teamSize) : null,
      }

      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      showMessage('✅ Базовый профиль сохранён!')
    } catch (error) {
      console.error('Error saving profile:', error)
      showMessage('❌ Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p>Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="card">
          <h1 className="text-3xl font-bold mb-2">Профиль пользователя</h1>
          <p className="text-gray-600">
            Ваш профиль используется ИИ-коучем для персонализированных рекомендаций и оценок
          </p>
        </div>

        {/* ===== БАЗОВЫЙ ПРОФИЛЬ ===== */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">Базовая информация</h2>

          {/* Личное */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Личное</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Имя</span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="input"
                  placeholder="Ваше имя"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Возраст</span>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  className="input"
                  placeholder="Возраст"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Где живу</span>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="input"
                  placeholder="Город, страна"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Семейное положение</span>
                <input
                  type="text"
                  value={profile.maritalStatus}
                  onChange={(e) => handleChange('maritalStatus', e.target.value)}
                  className="input"
                  placeholder="Например: женат/замужем, есть дети"
                />
              </label>
            </div>
          </div>

          {/* Профессиональная информация */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700 pt-4 border-t border-gray-100">
              Профессиональное
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Должность</span>
                <input
                  type="text"
                  value={profile.occupation}
                  onChange={(e) => handleChange('occupation', e.target.value)}
                  className="input"
                  placeholder="Например: CEO, руководитель отдела"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Вид деятельности</span>
                <input
                  type="text"
                  value={profile.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                  className="input"
                  placeholder="Например: IT, медицина, образование"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Размер команды</span>
                <input
                  type="number"
                  value={profile.teamSize}
                  onChange={(e) => handleChange('teamSize', e.target.value)}
                  className="input"
                  placeholder="Количество человек"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Образование</span>
                <input
                  type="text"
                  value={profile.education}
                  onChange={(e) => handleChange('education', e.target.value)}
                  className="input"
                  placeholder="Например: Высшее техническое, MBA"
                />
              </label>
            </div>

            <label className="block mt-4">
              <span className="text-gray-700 font-medium mb-2 block">Опыт работы</span>
              <textarea
                value={profile.workExperience}
                onChange={(e) => handleChange('workExperience', e.target.value)}
                className="textarea"
                placeholder="Кратко опишите ваш профессиональный путь"
                rows={3}
              />
            </label>
          </div>

          {/* Личные интересы */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700 pt-4 border-t border-gray-100">
              Интересы
            </h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Хобби</span>
                <input
                  type="text"
                  value={profile.hobbies}
                  onChange={(e) => handleChange('hobbies', e.target.value)}
                  className="input"
                  placeholder="Например: чтение, путешествия"
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Спорт</span>
                <input
                  type="text"
                  value={profile.sports}
                  onChange={(e) => handleChange('sports', e.target.value)}
                  className="input"
                  placeholder="Например: бег, йога, плавание"
                />
              </label>
            </div>
          </div>

          {/* Ценности и вызовы */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-700 pt-4 border-t border-gray-100">
              Ценности и приоритеты
            </h3>
            <div className="space-y-4">
              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Мои ценности</span>
                <textarea
                  value={profile.values}
                  onChange={(e) => handleChange('values', e.target.value)}
                  className="textarea"
                  placeholder="Что для вас важно в жизни и работе?"
                  rows={3}
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Текущие вызовы</span>
                <textarea
                  value={profile.challenges}
                  onChange={(e) => handleChange('challenges', e.target.value)}
                  className="textarea"
                  placeholder="С какими сложностями вы сталкиваетесь?"
                  rows={3}
                />
              </label>

              <label className="block">
                <span className="text-gray-700 font-medium mb-2 block">Другое</span>
                <textarea
                  value={profile.other}
                  onChange={(e) => handleChange('other', e.target.value)}
                  className="textarea"
                  placeholder="Дополнительная информация"
                  rows={3}
                />
              </label>
            </div>
          </div>

          <button onClick={saveProfile} disabled={saving} className="btn-primary mt-6 w-full">
            {saving ? 'Сохранение...' : 'Сохранить базовый профиль'}
          </button>
        </div>


        {/* Message Toast */}
        {message && (
          <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
            <p className="font-medium">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
