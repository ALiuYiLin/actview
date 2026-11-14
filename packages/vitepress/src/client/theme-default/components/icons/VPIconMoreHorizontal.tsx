import { ActViewComponent, Component } from 'actview'

@Component({ name: "VPIconMoreHorizontal" })
export class VPIconMoreHorizontal extends ActViewComponent {
  render() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 24 24">      
          <circle cx="12" cy="12" r="2" />      
          <circle cx="19" cy="12" r="2" />      
          <circle cx="5" cy="12" r="2" />      
        </svg>
    )
  }
}
