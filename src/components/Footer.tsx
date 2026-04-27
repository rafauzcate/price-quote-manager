export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-slate-600">
            © {new Date().getFullYear()} VantagePM. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
