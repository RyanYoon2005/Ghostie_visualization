import { alpha } from '@mui/material/styles';
import { outlinedInputClasses } from '@mui/material/OutlinedInput';
import { svgIconClasses } from '@mui/material/SvgIcon';
import { toggleButtonGroupClasses } from '@mui/material/ToggleButtonGroup';
import { toggleButtonClasses } from '@mui/material/ToggleButton';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { gray, brand } from '../themePrimitives';

/* eslint-disable import/prefer-default-export */
export const inputsCustomizations = {
  MuiButtonBase: {
    defaultProps: {
      disableTouchRipple: true,
      disableRipple: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        boxSizing: 'border-box',
        transition: 'all 100ms ease-in',
        '&:focus-visible': {
          outline: `3px solid ${alpha(theme.palette.primary.main, 0.5)}`,
          outlineOffset: '2px',
        },
      }),
    },
  },
  MuiButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: 'none',
        borderRadius: (theme.vars || theme).shape.borderRadius,
        textTransform: 'none',
        variants: [
          {
            props: {
              size: 'small',
            },
            style: {
              height: '2.25rem',
              padding: '8px 12px',
            },
          },
          {
            props: {
              size: 'medium',
            },
            style: {
              height: '2.5rem', // 40px
            },
          },
          {
            props: {
              color: 'primary',
              variant: 'contained',
            },
            style: {
              color: 'hsl(40,30%,96%)',
              backgroundColor: 'hsl(15,45%,42%)',
              backgroundImage: 'linear-gradient(to bottom, hsl(15,45%,48%), hsl(15,45%,40%))',
              border: '1px solid hsl(15,45%,38%)',
              boxShadow: 'none',
              '&:hover': {
                backgroundImage: 'none',
                backgroundColor: 'hsl(15,45%,38%)',
              },
              '&:active': {
                backgroundColor: 'hsl(15,45%,36%)',
              },
            },
          },
          {
            props: {
              color: 'secondary',
              variant: 'contained',
            },
            style: {
              color: 'hsl(40,30%,96%)',
              backgroundColor: 'hsl(35,45%,42%)',
              backgroundImage: 'linear-gradient(to bottom, hsl(35,45%,48%), hsl(35,45%,40%))',
              border: '1px solid hsl(35,45%,38%)',
              '&:hover': {
                backgroundColor: 'hsl(35,45%,38%)',
                boxShadow: 'none',
              },
              '&:active': {
                backgroundColor: 'hsl(35,45%,36%)',
                backgroundImage: 'none',
              },
            },
          },
          {
            props: {
              variant: 'outlined',
            },
            style: {
              color: 'hsl(0,0%,15%)',
              border: '1px solid',
              borderColor: 'hsl(35,20%,68%)',
              backgroundColor: 'hsl(40,35%,94%)',
              '&:hover': {
                backgroundColor: 'hsl(40,35%,88%)',
                borderColor: 'hsl(35,20%,55%)',
              },
              '&:active': {
                backgroundColor: 'hsl(40,30%,82%)',
              },
            },
          },
          {
            props: {
              color: 'secondary',
              variant: 'outlined',
            },
            style: {
              color: brand[700],
              border: '1px solid',
              borderColor: brand[200],
              backgroundColor: brand[50],
              '&:hover': {
                backgroundColor: brand[100],
                borderColor: brand[400],
              },
              '&:active': {
                backgroundColor: alpha(brand[200], 0.7),
              },
              ...theme.applyStyles('dark', {
                color: brand[50],
                border: '1px solid',
                borderColor: brand[900],
                backgroundColor: alpha(brand[900], 0.3),
                '&:hover': {
                  borderColor: brand[700],
                  backgroundColor: alpha(brand[900], 0.6),
                },
                '&:active': {
                  backgroundColor: alpha(brand[900], 0.5),
                },
              }),
            },
          },
          {
            props: {
              variant: 'text',
            },
            style: {
              color: gray[600],
              '&:hover': {
                backgroundColor: gray[100],
              },
              '&:active': {
                backgroundColor: gray[200],
              },
              ...theme.applyStyles('dark', {
                color: gray[50],
                '&:hover': {
                  backgroundColor: gray[700],
                },
                '&:active': {
                  backgroundColor: alpha(gray[700], 0.7),
                },
              }),
            },
          },
          {
            props: {
              color: 'secondary',
              variant: 'text',
            },
            style: {
              color: brand[700],
              '&:hover': {
                backgroundColor: alpha(brand[100], 0.5),
              },
              '&:active': {
                backgroundColor: alpha(brand[200], 0.7),
              },
              ...theme.applyStyles('dark', {
                color: brand[100],
                '&:hover': {
                  backgroundColor: alpha(brand[900], 0.5),
                },
                '&:active': {
                  backgroundColor: alpha(brand[900], 0.3),
                },
              }),
            },
          },
        ],
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: 'none',
        borderRadius: (theme.vars || theme).shape.borderRadius,
        textTransform: 'none',
        fontWeight: theme.typography.fontWeightMedium,
        letterSpacing: 0,
        color: 'hsl(0,0%,15%)',
        border: '1px solid hsl(35,20%,68%)',
        backgroundColor: 'hsl(40,35%,94%)',
        '&:hover': {
          backgroundColor: 'hsl(40,35%,88%)',
          borderColor: 'hsl(35,20%,55%)',
        },
        '&:active': {
          backgroundColor: 'hsl(40,30%,82%)',
        },
        variants: [
          {
            props: {
              size: 'small',
            },
            style: {
              width: '2.25rem',
              height: '2.25rem',
              padding: '0.25rem',
              [`& .${svgIconClasses.root}`]: { fontSize: '1rem' },
            },
          },
          {
            props: {
              size: 'medium',
            },
            style: {
              width: '2.5rem',
              height: '2.5rem',
            },
          },
        ],
      }),
    },
  },
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: {
        borderRadius: '10px',
        boxShadow: 'none',
      },
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: {
        padding: '12px 16px',
        textTransform: 'none',
        borderRadius: '10px',
        fontWeight: 500,
        boxShadow: 'none',
      },
    },
  },
  MuiSwitch: {
    styleOverrides: {
      thumb: {
        boxShadow: 'none',
        // Off-state thumb: warm grey with a faint border so it reads as "off", not as a stray dot.
        backgroundColor: 'hsl(35,15%,75%)',
        border: '1px solid hsl(35,15%,55%)',
      },
      track: {
        // Off-state track: deeper than the page so the switch shape is obvious.
        backgroundColor: 'hsl(35,15%,68%) !important',
        opacity: '1 !important',
        border: '1px solid hsl(35,15%,55%)',
      },
      switchBase: {
        '&.Mui-checked': {
          '& + .MuiSwitch-track': {
            // On-state track: muted sage to match boutique primary.
            backgroundColor: 'hsl(95,30%,42%) !important',
            borderColor: 'hsl(95,30%,32%)',
            opacity: '1 !important',
          },
          '& .MuiSwitch-thumb': {
            backgroundColor: 'hsl(40,40%,96%)',
            borderColor: 'hsl(95,30%,32%)',
          },
        },
      },
    },
  },
  MuiCheckbox: {
    defaultProps: {
      disableRipple: true,
      icon: (
        <CheckBoxOutlineBlankRoundedIcon sx={{ color: 'hsla(210, 0%, 0%, 0.0)' }} />
      ),
      checkedIcon: <CheckRoundedIcon sx={{ height: 14, width: 14 }} />,
      indeterminateIcon: <RemoveRoundedIcon sx={{ height: 14, width: 14 }} />,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        margin: 10,
        height: 16,
        width: 16,
        borderRadius: 5,
        border: '1px solid ',
        borderColor: alpha(gray[300], 0.8),
        boxShadow: '0 0 0 1.5px hsla(210, 0%, 0%, 0.04) inset',
        backgroundColor: alpha(gray[100], 0.4),
        transition: 'border-color, background-color, 120ms ease-in',
        '&:hover': {
          borderColor: brand[300],
        },
        '&.Mui-focusVisible': {
          outline: `3px solid ${alpha(brand[500], 0.5)}`,
          outlineOffset: '2px',
          borderColor: brand[400],
        },
        '&.Mui-checked': {
          color: 'white',
          backgroundColor: brand[500],
          borderColor: brand[500],
          boxShadow: `none`,
          '&:hover': {
            backgroundColor: brand[600],
          },
        },
        ...theme.applyStyles('dark', {
          borderColor: alpha(gray[700], 0.8),
          boxShadow: '0 0 0 1.5px hsl(210, 0%, 0%) inset',
          backgroundColor: alpha(gray[900], 0.8),
          '&:hover': {
            borderColor: brand[300],
          },
          '&.Mui-focusVisible': {
            borderColor: brand[400],
            outline: `3px solid ${alpha(brand[500], 0.5)}`,
            outlineOffset: '2px',
          },
        }),
      }),
    },
  },
  MuiInputBase: {
    styleOverrides: {
      root: {
        border: 'none',
      },
      input: {
        '&::placeholder': {
          opacity: 0.7,
          color: gray[500],
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      input: {
        padding: 0,
      },
      root: ({ theme }) => ({
        padding: '8px 12px',
        color: (theme.vars || theme).palette.text.primary,
        borderRadius: (theme.vars || theme).shape.borderRadius,
        border: `1px solid ${(theme.vars || theme).palette.divider}`,
        backgroundColor: (theme.vars || theme).palette.background.default,
        transition: 'border 120ms ease-in',
        '&:hover': {
          borderColor: gray[400],
        },
        [`&.${outlinedInputClasses.focused}`]: {
          outline: `3px solid ${alpha(brand[500], 0.5)}`,
          borderColor: brand[400],
        },
        ...theme.applyStyles('dark', {
          '&:hover': {
            borderColor: gray[500],
          },
        }),
        variants: [
          {
            props: {
              size: 'small',
            },
            style: {
              height: '2.25rem',
            },
          },
          {
            props: {
              size: 'medium',
            },
            style: {
              height: '2.5rem',
            },
          },
        ],
      }),
      notchedOutline: {
        border: 'none',
      },
    },
  },
  MuiInputAdornment: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: (theme.vars || theme).palette.grey[500],
        ...theme.applyStyles('dark', {
          color: (theme.vars || theme).palette.grey[400],
        }),
      }),
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: ({ theme }) => ({
        typography: theme.typography.caption,
        marginBottom: 8,
      }),
    },
  },
  // The theme replaces MUI's notched outline with a plain border on the input root,
  // which leaves the floating label sitting on top of the border line. Paint the
  // shrunk label with the input's own background colour + side padding so it visually
  // "cuts through" the border just like a native notched outline would.
  MuiInputLabel: {
    styleOverrides: {
      root: ({ theme }) => ({
        [`&.MuiInputLabel-outlined`]: {
          [`&.MuiInputLabel-shrink`]: {
            backgroundColor: (theme.vars || theme).palette.background.default,
            paddingLeft: 6,
            paddingRight: 6,
            transform: 'translate(10px, -9px) scale(0.75)',
            borderRadius: 4,
          },
        },
      }),
    },
  },
};
