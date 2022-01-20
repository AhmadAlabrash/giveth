import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import { BigNumberish } from '@ethersproject/bignumber'
import { formatEther } from '@ethersproject/units'

import { initializeApollo } from '../apollo/apolloClient'
import { GET_USER_BY_ADDRESS } from '../apollo/gql/gqlUser'
import { IUserByAddress } from '../apollo/types/gqlTypes'
import { compareAddresses, LocalStorageTokenLabel, signMessage } from '../lib/helpers'
import * as Auth from '../services/auth'
import { getToken } from '../services/token'
import User from '../entities/user'
import useWallet from '@/hooks/walletHooks'

interface IUserContext {
  state: {
    user?: IUserByAddress
    balance?: string | null
    isEnabled?: boolean
    isSignedIn?: boolean
  }
  actions: {
    signIn?: () => Promise<boolean>
    signOut?: () => void
  }
}

const UserContext = createContext<IUserContext>({
  state: {
    user: {},
    isEnabled: false,
    isSignedIn: false
  },
  actions: {
    signIn: async () => false,
    signOut: () => {}
  }
})

const apolloClient = initializeApollo()

export const UserProvider = (props: { children: ReactNode }) => {
  const [user, setUser] = useState<IUserByAddress | undefined>()
  const [balance, setBalance] = useState<string | null>(null)

  useWallet()
  const context = useWeb3React()
  const { account, active, library, chainId, deactivate } = context
  const isEnabled = !!library?.getSigner() && !!account && !!chainId
  const isSignedIn = isEnabled && !!user?.token

  useEffect(() => {
    localStorage.removeItem(LocalStorageTokenLabel)
    if (active && account) {
      fetchUser().then(setUser)
    } else {
      user && setUser(undefined)
    }
  }, [active, account])

  useEffect(() => {
    if (user) {
      // setToken().then()
    }
  }, [user])

  const fetchLocalUser = (): User => {
    const localUser = Auth.getUser() as User
    return new User(localUser)
  }

  const fetchUser = () => {
    return apolloClient
      .query({
        query: GET_USER_BY_ADDRESS,
        variables: {
          address: account?.toLowerCase()
        },
        fetchPolicy: 'network-only'
      })
      .then((res: any) => {
        return res.data?.userByAddress
      })
      .catch(console.log)
  }

  const signIn = async () => {
    console.log('trigou')
    if (!library.getSigner()) return false

    const signedMessage = await signMessage(
      process.env.NEXT_PUBLIC_OUR_SECRET as string,
      account,
      chainId,
      library.getSigner()
    )
    if (!signedMessage) return false

    const token = await getToken(account, signedMessage, chainId, user)
    const localUser = fetchLocalUser()

    if (account !== localUser?.walletAddress) {
      Auth.logout()
      const DBUser = await fetchUser()
      const newUser = new User(DBUser)
      newUser.setToken(token)
      Auth.setUser(newUser)
      await apolloClient.resetStore()
      setUser(newUser)
    } else {
      localUser.setToken(token)
      Auth.setUser(localUser)
      await apolloClient.resetStore()
      setUser(localUser)
    }
    return true
  }

  const signOut = () => {
    Auth.logout()
    window.localStorage.removeItem('selectedWallet')
    apolloClient.resetStore().then()
    deactivate()
    setUser(undefined)
  }

  // const setToken = async () => {
  //   const signedMessage = await signMessage(
  //     config.OUR_SECRET,
  //     account,
  //     chainId,
  //     library.getSigner()
  //   )
  //   console.log('signedMessage', signedMessage)
  //   if (!signedMessage) return false
  //   const token = await getToken(account, signedMessage, chainId, user)
  //   console.log('token', token)
  //   localStorage.setItem(LocalStorageTokenLabel, token)
  //   return true
  // }

  useEffect(() => {
    if (!!account && !!library) {
      library
        .getBalance(account)
        .then((_balance: BigNumberish) => {
          setBalance(parseFloat(formatEther(_balance)).toFixed(3))
        })
        .catch(() => setBalance(null))
    }
  }, [account, library, chainId])

  useEffect(() => {
    if (account) {
      const _user = Auth.getUser()
      if (compareAddresses(account, _user?.walletAddress || '')) {
        const newUser = new User(_user as User)
        setUser(newUser)
      } else {
        Auth.logout()
        fetchUser().then((res: any) => {
          if (res) {
            const newUser = new User(res)
            Auth.setUser(newUser)
            setUser(newUser)
          } else {
            const noUser = new User({} as User)
            setUser(noUser)
          }
        })
      }
    } else {
      if (user) setUser(undefined)
    }
  }, [account])

  return (
    <UserContext.Provider
      value={{
        state: {
          user,
          balance,
          isEnabled,
          isSignedIn
        },
        actions: {
          // updateUser,
          // showSign,
          // signModalContent,
          // setToken
          signIn,
          signOut
        }
      }}
    >
      {props.children}
    </UserContext.Provider>
  )
}

export default function useUser() {
  const context = useContext(UserContext)

  if (!context) {
    throw new Error('Claim context not found!')
  }

  return context
}
