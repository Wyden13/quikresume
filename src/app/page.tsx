import React from 'react';
import Link from 'next/link';
import { auth } from "@/auth";
import Image from 'next/image';

export default async function Home() {
  const session = await auth();

  return (
      <div className="min-h-screen bg-white text-black font-sans">
        {/* Header */}
        <header className="flex flex-row justify-between items-center px-6 py-6 md:px-16 md:py-6 w-full max-w-[1280px] mx-auto">
          <div className="flex flex-row items-center gap-2">
            {/* Logo Image */}
            <Image
                src="/icons/quik-resume.svg"
                alt="quikResume Logo"
                width={40}
                height={40}
                className="w-7 h-7 md:w-10 md:h-10"
            />
            <span className="font-semibold text-lg md:text-2xl tracking-tight">quikResume</span>
          </div>
          <div className="flex flex-row items-center gap-6">
            {session ? (
                <Link href="/dashboard" className="flex justify-center items-center px-4 py-3 bg-black text-white rounded-xl font-medium text-base">
                  Dashboard
                </Link>
            ) : (
                <>
                  <Link href="/login" className="hidden md:flex font-medium text-base hover:text-black/70 transition-colors">
                    Login
                  </Link>
                  <Link href="/login" className="flex justify-center items-center px-4 py-3 bg-black text-white rounded-xl font-medium text-base hover:bg-black/80 transition-colors">
                    Sign Up
                  </Link>
                </>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section className="flex flex-col md:flex-row justify-center items-start md:items-center w-full max-w-[1280px] mx-auto md:h-[540px]">
          {/* Mobile Image */}
          <div className="w-full h-[298px] bg-gray-100 md:hidden"></div>

          <div className="flex flex-col justify-center items-start px-6 py-14 md:px-16 md:py-[120px] gap-8 md:w-1/2">
            <div className="flex flex-col gap-4 md:gap-6">
              <h1 className="font-bold text-[40px] leading-[110%] md:text-[56px] tracking-tight text-center md:text-left">
                Streamline your<br />Job Applications!
              </h1>
              <p className="font-medium text-lg md:text-2xl leading-[145%] text-black/55 text-center md:text-left">
                Create Resumes, Cover Letters and Apply with just click of a button!
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              {session ? (
                  <Link href="/dashboard" className="w-full md:w-auto flex justify-center items-center px-6 py-3 bg-black text-white rounded-xl font-medium text-lg hover:bg-black/80 transition-colors">
                    Go to Dashboard
                  </Link>
              ) : (
                  <>
                    <Link href="/login" className="w-full md:w-auto flex justify-center items-center px-6 py-3 bg-black text-white rounded-xl font-medium text-lg hover:bg-black/80 transition-colors">
                      Join Now!
                    </Link>
                    <Link href="/login" className="w-full md:w-auto flex justify-center items-center px-6 py-3 border-2 border-black/15 text-black rounded-xl font-medium text-lg hover:bg-black/5 transition-colors">
                      Login
                    </Link>
                  </>
              )}
            </div>
          </div>

          {/* Desktop Image */}
          <div className="hidden md:block w-1/2 h-full bg-gray-100 rounded-l-2xl"></div>
        </section>

        {/* Features Section */}
        <section className="flex flex-col items-center w-full max-w-[1280px] mx-auto">
          {/* Row 1 */}
          <div className="flex flex-col md:flex-row justify-center items-center px-6 py-10 md:px-16 md:py-20 gap-8 md:gap-16 w-full">
            <div className="w-full md:w-[544px] h-[243px] md:h-[432px] bg-pink-100 rounded-2xl order-1 md:order-2 md:hidden"></div>
            <div className="flex flex-col justify-center items-start gap-10 md:gap-12 w-full md:w-1/2 order-2 md:order-1">
              <div className="flex flex-col gap-4 md:gap-6 w-full">
                <h2 className="font-bold text-[24px] md:text-[36px] leading-[120%] tracking-tight">
                  Tailor your resume in seconds!
                </h2>
                <p className="font-medium text-[16px] md:text-[18px] leading-[145%] text-black/55">
                  With our powerful resume generation engine, tailor your resume for each job you&apos;ll be applying - no more PDF hassles!
                </p>
              </div>
              <Link href={session ? "/dashboard" : "/login"} className="w-full md:w-auto flex justify-center items-center px-4 py-3 bg-black text-white rounded-xl font-medium text-[16px] md:text-[18px] hover:bg-black/80 transition-colors">
                Try Now!
              </Link>
            </div>
            <div className="hidden md:block w-[544px] h-[432px] bg-pink-100 rounded-2xl order-2"></div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col md:flex-row justify-center items-center px-6 py-8 md:px-16 md:py-10 gap-8 md:gap-16 w-full">
            <div className="w-full md:w-[544px] h-[243px] md:h-[432px] bg-purple-200 rounded-2xl order-1"></div>
            <div className="flex flex-col justify-center items-start gap-10 md:gap-12 w-full md:w-1/2 order-2">
              <div className="flex flex-col gap-4 md:gap-6 w-full">
                <h2 className="font-bold text-[24px] md:text-[36px] leading-[120%] tracking-tight">
                  Generate Cover Letters and Apply!
                </h2>
                <p className="font-medium text-[16px] md:text-[18px] leading-[145%] text-black/55">
                  Generate your CV for every job, reducing the time it takes to complete your application process.
                </p>
              </div>
              <Link href={session ? "/dashboard" : "/login"} className="w-full md:w-auto flex justify-center items-center px-4 py-3 bg-black text-white rounded-xl font-medium text-[16px] md:text-[18px] hover:bg-black/80 transition-colors">
                Try Now!
              </Link>
            </div>
          </div>
        </section>

        {/* Info Row */}
        <section className="bg-black/5 w-full">
          <div className="flex flex-col md:flex-row items-start px-6 py-10 md:px-16 md:py-[120px] gap-12 max-w-[1280px] mx-auto">
            <div className="flex flex-col items-start pt-6 gap-3 md:gap-4 border-t border-black/15 flex-1 w-full">
              <h3 className="font-bold text-[18px] md:text-[24px] leading-none tracking-tight">
                Use Our Web- Extension
              </h3>
              <p className="font-medium text-[16px] leading-[145%] text-black/55">
                Our web extension allows you to auto fill the details from your resume to every application site!
              </p>
            </div>
            <div className="flex flex-col items-start pt-6 gap-3 md:gap-4 border-t border-black/15 flex-1 w-full">
              <h3 className="font-bold text-[18px] md:text-[24px] leading-none tracking-tight">
                Hassle Free Handling
              </h3>
              <p className="font-medium text-[16px] leading-[145%] text-black/55">
                We will save all your resumes and track which jobs you applied for.
              </p>
            </div>
            <div className="flex flex-col items-start pt-6 gap-3 md:gap-4 border-t border-black/15 flex-1 w-full">
              <h3 className="font-bold text-[18px] md:text-[24px] leading-none tracking-tight">
                Powerful AI tools
              </h3>
              <p className="font-medium text-[16px] leading-[145%] text-black/55">
                Our AI tools allow you to tailor your resume perfectly for every kind of job!
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full max-w-[1280px] mx-auto border-t border-black/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-6 py-16 md:p-16 gap-14 md:gap-[120px]">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
              <div className="flex flex-row items-center gap-2">
                {/* Footer Logo Image */}
                <Image
                    src="/icons/quik-resume.svg"
                    alt="quikResume Logo"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                />
                <span className="font-semibold text-[18px] md:text-[20px] tracking-tight">quikResume</span>
              </div>
              <nav className="flex flex-col md:flex-row items-start gap-4 md:gap-8">
                <Link href="#" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Features</Link>
                <Link href="#" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Learn more</Link>
                <Link href="#" className="font-medium text-[16px] text-black/55 hover:text-black transition-colors">Support</Link>
              </nav>
            </div>
            <p className="text-[12px] text-black/30 font-bold uppercase tracking-widest">
              &copy; {new Date().getFullYear()} quikResume
            </p>
          </div>
        </footer>
      </div>
  );
}