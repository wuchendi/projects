import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@cdlab/ui/components/select'
import { CURRENCY_CONFIG } from '@/lib/currencies'

interface CurrencySelectorProps {
  value: string
  onChange: (value: string) => void
  excludeCurrencies?: string[]
}

export default function CurrencySelector({
  value,
  onChange,
  excludeCurrencies = [],
}: CurrencySelectorProps) {
  const getCurrencyInfo = (currencyValue: string) => {
    const crypto = CURRENCY_CONFIG.crypto.find((c) => c.value === currencyValue)
    const fiat = CURRENCY_CONFIG.fiat.find((f) => f.value === currencyValue)
    const product = CURRENCY_CONFIG.products.find(
      (p) => p.value === currencyValue,
    )
    return crypto || fiat || product
  }

  const currentCurrency = getCurrencyInfo(value)

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next)
      }}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue>
          {currentCurrency ? (
            <span className="truncate">{currentCurrency.label}</span>
          ) : (
            <span>Select Currency</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[210px]">
        <SelectGroup>
          <SelectLabel>🚀 Cryptocurrency</SelectLabel>
          {CURRENCY_CONFIG.crypto.map((currency) => (
            <SelectItem
              key={currency.value}
              value={currency.value}
              disabled={excludeCurrencies.includes(currency.value)}
              className="text-sm"
            >
              {currency.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>💰 Fiat Currency</SelectLabel>
          {CURRENCY_CONFIG.fiat.map((currency) => (
            <SelectItem
              key={currency.value}
              value={currency.value}
              disabled={excludeCurrencies.includes(currency.value)}
              className="text-sm"
            >
              {currency.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>🛍️ Products</SelectLabel>
          {CURRENCY_CONFIG.products.map((product) => (
            <SelectItem
              key={product.value}
              value={product.value}
              disabled={excludeCurrencies.includes(product.value)}
              className="text-sm"
            >
              {product.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
