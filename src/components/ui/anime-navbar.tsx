"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link, useLocation } from "react-router-dom"
import { LucideIcon, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
  defaultActive?: string
  onLogout?: () => void
}

export function AnimeNavBar({ items, className, defaultActive = "Home", onLogout }: NavBarProps) {
  const location = useLocation()
  const [mounted, setMounted] = useState(false)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(defaultActive)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed top-2 left-0 right-0 z-[9999]">
      <div className="flex justify-center px-2">
        <motion.div 
          className="flex items-center gap-0.5 md:gap-1 bg-black/50 border border-white/10 backdrop-blur-lg py-1 px-1 md:py-1.5 md:px-2 rounded-full shadow-lg relative max-w-[95vw] md:max-w-none"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.name
            const isHovered = hoveredTab === item.name

            return (
              <Link
                key={item.name}
                to={item.url}
                onClick={() => {
                  setActiveTab(item.name)
                }}
                onMouseEnter={() => setHoveredTab(item.name)}
                onMouseLeave={() => setHoveredTab(null)}
                className={cn(
                  "relative cursor-pointer text-xs md:text-sm font-semibold px-2 py-2 md:px-4 md:py-2.5 rounded-full transition-all duration-300",
                  "text-white/70 hover:text-white",
                  isActive && "text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full -z-10 overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0.3, 0.5, 0.3],
                      scale: [1, 1.03, 1]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <div className="absolute inset-0 bg-blue-500/25 rounded-full blur-md" />
                    <div className="absolute inset-[-4px] bg-blue-500/20 rounded-full blur-xl" />
                    <div className="absolute inset-[-8px] bg-blue-500/15 rounded-full blur-2xl" />
                    <div className="absolute inset-[-12px] bg-blue-500/5 rounded-full blur-3xl" />
                    
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0"
                      style={{
                        animation: "shine 3s ease-in-out infinite"
                      }}
                    />
                  </motion.div>
                )}

                <motion.span
                  className="hidden sm:inline relative z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {item.name}
                </motion.span>
                <motion.span 
                  className="sm:hidden relative z-10 flex items-center justify-center"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon size={16} strokeWidth={2.5} />
                </motion.span>
          
                <AnimatePresence>
                  {isHovered && !isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 bg-white/10 rounded-full -z-10"
                    />
                  )}
                </AnimatePresence>

                {isActive && (
                  <motion.div
                    layoutId="anime-mascot"
                    className="absolute -top-8 md:-top-10 left-1/2 -translate-x-1/2 pointer-events-none hidden md:block"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  >
                    <div className="relative w-8 h-8 md:w-10 md:h-10">
                      <motion.div 
                        className="absolute w-6 h-6 md:w-8 md:h-8 bg-white rounded-full left-1/2 -translate-x-1/2"
                        animate={
                          hoveredTab ? {
                            scale: [1, 1.1, 1],
                            rotate: [0, -5, 5, 0],
                            transition: {
                              duration: 0.5,
                              ease: "easeInOut"
                            }
                          } : {
                            y: [0, -3, 0],
                            transition: {
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }
                          }
                        }
                      >
                        <motion.div 
                          className="absolute w-2 h-2 bg-black rounded-full"
                          animate={
                            hoveredTab ? {
                              scaleY: [1, 0.2, 1],
                              transition: {
                                duration: 0.2,
                                times: [0, 0.5, 1]
                              }
                            } : {}
                          }
                          style={{ left: '25%', top: '40%' }}
                        />
                        <motion.div 
                          className="absolute w-2 h-2 bg-black rounded-full"
                          animate={
                            hoveredTab ? {
                              scaleY: [1, 0.2, 1],
                              transition: {
                                duration: 0.2,
                                times: [0, 0.5, 1]
                              }
                            } : {}
                          }
                          style={{ right: '25%', top: '40%' }}
                        />
                        <motion.div 
                          className="absolute w-2 h-1.5 bg-pink-300 rounded-full"
                          animate={{
                            opacity: hoveredTab ? 0.8 : 0.6
                          }}
                          style={{ left: '15%', top: '55%' }}
                        />
                        <motion.div 
                          className="absolute w-2 h-1.5 bg-pink-300 rounded-full"
                          animate={{
                            opacity: hoveredTab ? 0.8 : 0.6
                          }}
                          style={{ right: '15%', top: '55%' }}
                        />
                        
                        <motion.div 
                          className="absolute w-4 h-2 border-b-2 border-black rounded-full"
                          animate={
                            hoveredTab ? {
                              scaleY: 1.5,
                              y: -1
                            } : {
                              scaleY: 1,
                              y: 0
                            }
                          }
                          style={{ left: '30%', top: '60%' }}
                        />
                        <AnimatePresence>
                          {hoveredTab && (
                            <>
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className="absolute -top-1 -right-1 w-2 h-2 text-yellow-300"
                              >
                                ✨
                              </motion.div>
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{ delay: 0.1 }}
                                className="absolute -top-2 left-0 w-2 h-2 text-yellow-300"
                              >
                                ✨
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <motion.div
                        className="absolute -bottom-0.5 md:-bottom-1 left-1/2 w-3 h-3 md:w-4 md:h-4 -translate-x-1/2"
                        animate={
                          hoveredTab ? {
                            y: [0, -4, 0],
                            transition: {
                              duration: 0.3,
                              repeat: Infinity,
                              repeatType: "reverse"
                            }
                          } : {
                            y: [0, 2, 0],
                            transition: {
                              duration: 1,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 0.5
                            }
                          }
                        }
                      >
                        <div className="w-full h-full bg-white rotate-45 transform origin-center" />
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </Link>
            )
          })}
          
          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              onMouseEnter={() => setHoveredTab('logout')}
              onMouseLeave={() => setHoveredTab(null)}
              className={cn(
                "relative cursor-pointer text-xs md:text-sm font-semibold px-2 py-2 md:px-4 md:py-2.5 rounded-full transition-all duration-300",
                "text-white/70 hover:text-white"
              )}
              type="button"
            >
              <motion.span
                className="hidden sm:inline relative z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                Logout
              </motion.span>
              <motion.span 
                className="sm:hidden relative z-10 flex items-center justify-center"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <LogOut size={16} strokeWidth={2.5} />
              </motion.span>
        
              <AnimatePresence>
                {hoveredTab === 'logout' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 bg-red-500/20 rounded-full -z-10"
                  />
                )}
              </AnimatePresence>
            </button>
          )}
        </motion.div>
      </div>
    </div>
  )
}
