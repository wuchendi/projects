'use client'

import { Button } from '@cdlab/ui/components/button'
import { IKFooter, IKPageContainer } from '@cdlab/ui/IK'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { ImageProps } from '@/utils/types'
import { useLastViewedPhoto } from '@/utils/useLastViewedPhoto'
import Bridge from './Icons/Bridge'
import { ThemeToggle } from './layout'
import Modal from './Modal'
import { BackToTop } from './ui/BackToTop'

export default function Gallery({ images }: { images: ImageProps[] }) {
  const searchParams = useSearchParams()
  const photoAssetId = searchParams.get('photoId')
  const [lastViewedAssetId, setLastViewedAssetId] = useLastViewedPhoto()

  const lastViewedPhotoRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (lastViewedAssetId && !photoAssetId) {
      lastViewedPhotoRef.current?.scrollIntoView({ block: 'center' })
      setLastViewedAssetId(null)
    }
  }, [photoAssetId, lastViewedAssetId, setLastViewedAssetId])

  const modalPhotoExists =
    photoAssetId !== null && images.some((img) => img.asset_id === photoAssetId)

  return (
    <>
      <IKPageContainer
        scrollable={false}
        className="block mx-auto w-full max-w-[1960px] p-4"
      >
        {modalPhotoExists && photoAssetId && (
          <Modal
            images={images}
            photoAssetId={photoAssetId}
            onClose={() => {
              setLastViewedAssetId(photoAssetId)
            }}
          />
        )}
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
          <div
            className="after:content relative mb-5 flex h-[629px] flex-col items-center justify-end gap-4 overflow-hidden rounded-lg px-6 pb-16 pt-64 text-center shadow-highlight after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:shadow-highlight lg:pt-0
            bg-black/5 border border-black/10
            dark:bg-white/10 dark:border-transparent
            text-gray-900 dark:text-white"
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-10 dark:opacity-20">
              <span className="flex max-h-full max-w-full items-center justify-center">
                <Bridge />
              </span>
              <span
                className="absolute left-0 right-0 bottom-0 h-[400px]
                bg-gradient-to-b from-white/0 via-white/80 to-white/95
                dark:from-black/0 dark:via-black dark:to-black"
              ></span>
            </div>

            <Image
              alt="Byshot logo"
              className="transform rounded-lg transition will-change-auto
                brightness-90 group-hover:brightness-110
                dark:brightness-90 dark:group-hover:brightness-110"
              style={{ transform: 'translate3d(0, 0, 0)' }}
              src="https://wcd.pages.dev/logo.png"
              width={150}
              height={150}
              sizes="(max-width: 640px) 100vw,
                  (max-width: 1280px) 50vw,
                  (max-width: 1536px) 33vw,
                  25vw"
            />
            <h1
              className="mt-8 mb-4 text-base font-bold uppercase tracking-widest
              text-gray-900 dark:text-white"
            >
              Personal Photography Collection
            </h1>
            <p
              className="max-w-[40ch] sm:max-w-[32ch]
              text-gray-600 dark:text-white/75"
            >
              A curated collection of moments captured through my lens
            </p>
            <div className="flex items-center pointer z-10 mt-6 md:mt-4 gap-4">
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href="https://wcd.pages.dev/"
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Blog
              </Button>
              <ThemeToggle />
            </div>
          </div>
          {images.map(({ id, asset_id, public_id, format, blurDataUrl }) => (
            <Link
              key={asset_id}
              href={`/?photoId=${asset_id}`}
              ref={asset_id === lastViewedAssetId ? lastViewedPhotoRef : null}
              scroll={false}
              className="after:content group relative mb-5 block w-full cursor-zoom-in after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:shadow-highlight"
            >
              <Image
                alt={`Photo ${id + 1} from the collection`}
                className="transform rounded-lg transition will-change-auto
                  brightness-95 group-hover:brightness-110
                  dark:brightness-90 dark:group-hover:brightness-110"
                style={{ transform: 'translate3d(0, 0, 0)' }}
                {...(blurDataUrl
                  ? { placeholder: 'blur', blurDataURL: blurDataUrl }
                  : {})}
                src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_scale,w_720/${public_id}.${format}`}
                width={720}
                height={480}
                sizes="(max-width: 640px) 100vw,
                  (max-width: 1280px) 50vw,
                  (max-width: 1536px) 33vw,
                  25vw"
              />
            </Link>
          ))}
        </div>
      </IKPageContainer>
      <IKFooter year={2023} />
      <BackToTop />
    </>
  )
}
