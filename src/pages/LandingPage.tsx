import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Button } from '../components/ui/Button';
import { PLAN_CONFIGS } from '../lib/subscription';

const features = [
  {
    title: 'AI-powered parsing',
    description: 'Extract line items, pricing and supplier metadata from PDFs and spreadsheets in seconds.',
  },
  {
    title: 'Team collaboration',
    description: 'Invite teammates, assign ownership and keep procurement decisions transparent.',
  },
  {
    title: 'Live analytics',
    description: 'Track quote velocity, conversion and supplier performance with premium dashboards.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slatePremium-50 text-slatePremium-900">
      <section className="relative overflow-hidden bg-premium-gradient pb-24 pt-8 text-white">
        <div className="absolute -left-28 top-16 h-80 w-80 rounded-full bg-gold-glow blur-2xl" />
        <div className="absolute right-0 top-0 h-72 w-72 animate-float rounded-full bg-gold-500/20 blur-3xl" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between">
            <BrandLogo />
            <div className="flex gap-3">
              <Link to="/login" className="text-sm text-slate-200 hover:text-white">
                Sign in
              </Link>
              <Link to="/signup">
                <Button>Start Free Trial</Button>
              </Link>
            </div>
          </div>

          <div className="mt-20 max-w-3xl">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-extrabold leading-tight"
            >
              Transform Your Quote Management
            </motion.h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-200">
              VantagePM turns fragmented supplier quotes into a premium decision platform built for fast-moving procurement teams.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button rightIcon={<ArrowRight size={16} />}>Start Free Trial</Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="border-white/40 text-white hover:bg-white/10">
                  View Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Why teams choose VantagePM</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="glass-card rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-navy-950">{feature.title}</h3>
              <p className="mt-2 text-sm text-slatePremium-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="text-center text-3xl font-bold">Simple pricing for every team size</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_CONFIGS.map((plan, idx) => (
            <div key={plan.id} className={`rounded-2xl border p-6 ${idx === 1 ? 'border-gold-500 bg-gold-500/10' : 'border-slatePremium-200 bg-white'}`}>
              {idx === 1 && <span className="mb-3 inline-flex rounded-full bg-gold-500 px-2 py-1 text-xs font-semibold text-navy-950">Most Popular</span>}
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-slatePremium-500">{plan.description}</p>
              <p className="mt-4 text-3xl font-bold">£{plan.priceGbp}</p>
              <p className="text-xs text-slatePremium-500">per month</p>
              <ul className="mt-4 space-y-2 text-sm text-slatePremium-700">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Trusted by procurement leaders</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {['Linear-grade UX', 'SaaS-ready performance', 'Enterprise-grade controls'].map((item, i) => (
            <div key={item} className="rounded-2xl border border-slatePremium-200 bg-white p-6">
              <div className="mb-2 flex gap-1 text-gold-500">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={`${i}-${idx}`} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="text-sm text-slatePremium-700">“{item}. VantagePM changed how we evaluate supplier quotes.”</p>
              <p className="mt-3 text-xs text-slatePremium-500">Procurement Director, Example Co.</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-navy-950 px-6 py-10 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row">
          <BrandLogo />
          <div className="text-sm">
            <p>Contact: hello@vantagepm.com</p>
            <p className="mt-1">© {new Date().getFullYear()} VantagePM. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
