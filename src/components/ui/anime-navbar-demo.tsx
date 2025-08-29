import * as React from "react"
import { Home, Calendar, MessageSquare, ShoppingBag, Gift } from "lucide-react"
import { AnimeNavBar } from "./anime-navbar"

const items = [
  {
    name: "Home",
    url: "/",
    icon: Home,
  },
  {
    name: "Events",
    url: "/events",
    icon: Calendar,
  },
  {
    name: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  {
    name: "Marketplace",
    url: "/marketplace",
    icon: ShoppingBag,
  },
  {
    name: "Rewards",
    url: "/rewards",
    icon: Gift,
  },
]

export function AnimeNavBarDemo() {
  return <AnimeNavBar items={items} defaultActive="Home" />
}
