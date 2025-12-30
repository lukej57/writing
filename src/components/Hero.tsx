import { Fragment } from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import { Highlight } from 'prism-react-renderer'

import { Button } from '@/components/Button'
import { HeroBackground } from '@/components/HeroBackground'
import blurCyanImage from '@/images/blur-cyan.png'
import blurIndigoImage from '@/images/blur-indigo.png'
import rubyFpCoreImage from '@/images/ruby_fp_core_2.png'
import rubyFpCoreInvertedImage from '@/images/ruby_fp_core_2_inverted.png'

const codeLanguage = 'javascript'
const code = `export default {
  strategy: 'predictive',
  engine: {
    cpus: 12,
    backups: ['./storage/cache.wtf'],
  },
}`

const tabs = [
  { name: 'cache-advance.config.js', isActive: true },
  { name: 'package.json', isActive: false },
]

function TrafficLightsIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 42 10" fill="none" {...props}>
      <circle cx="5" cy="5" r="4.5" />
      <circle cx="21" cy="5" r="4.5" />
      <circle cx="37" cy="5" r="4.5" />
    </svg>
  )
}

export function Hero() {
  return (
    <div className="overflow-hidden bg-white dark:bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
      <div className="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
        <div className="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-8 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
          <div className="relative lg:static xl:pl-10">
            <div className="relative flex justify-center lg:justify-start">
              <Image
                src={rubyFpCoreImage}
                alt="Ruby FP Core"
                className="w-48 dark:hidden"
                unoptimized
                priority
              />
              <Image
                src={rubyFpCoreInvertedImage}
                alt="Ruby FP Core"
                className="w-48 hidden dark:block"
                unoptimized
                priority
              />
            </div>
          </div>
          <div className="relative z-10 md:text-center lg:text-left">
            <Image
              className="absolute right-full bottom-full -mr-72 -mb-56 opacity-50"
              src={blurCyanImage}
              alt=""
              width={530}
              height={530}
              unoptimized
              priority
            />
            <div className="relative">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Thoughts on principled software development, Ruby and Rails.
              </h1>
              <p className="mt-3 text-2xl tracking-tight text-slate-600 dark:text-slate-400">
                by Luke Jeremy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
