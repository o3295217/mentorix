const CURRENT_YEAR = new Date().getFullYear()

export default function FooterSection() {
  return (
    <footer className="border-t border-gray-800/40 py-10 px-4">
      <div className="max-w-7xl mx-auto text-center text-gray-700 text-sm">
        © {CURRENT_YEAR} ION AI Lab.
      </div>
    </footer>
  )
}
